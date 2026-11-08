import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RedisService } from "../redis/redis.service.js";

const RELEASE_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end
  return 0
`;

const RENEW_LOCK_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
  end
  return 0
`;

const SET_CACHE_IF_LOCK_OWNED_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
    return 1
  end

  return 0
`;

const DELETE_CACHE_IF_LOCK_OWNED_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[2])
  end

  return 0
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_WAIT_MS = 2_000;
const RETRY_DELAY_MS = 50;

export interface Product {
  id: string;
  name: string;
  price: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly redisService: RedisService) {}

  private products: Product[] = [
    { id: "1", name: "Keyboard", price: 1200 },
    { id: "2", name: "Mouse", price: 500 },
  ];

  async loadProduct(id: string): Promise<Product | null> {
    return this.products.find((product) => product.id === id) ?? null;
  }

  private async startLockRenewal(
    lockKey: string,
    lockToken: string,
  ): Promise<{ stop: () => void; lockLost: Promise<never> }> {
    let stopped = false;

    let rejectLockLost!: (error: Error) => void;

    const lockLost = new Promise<never>((_, reject) => {
      rejectLockLost = reject;
    });

    void lockLost.catch(() => {});

    const stop = () => {
      stopped = true;
    };

    const renew = async (): Promise<void> => {
      if (stopped) return;

      await sleep(5_000);

      if (stopped) return;

      const client = this.redisService.getClient();

      try {
        const result = await client.eval(RENEW_LOCK_SCRIPT, {
          keys: [lockKey],
          arguments: [lockToken, "10000"],
        });

        if (result === 0) {
          stopped = true;
          rejectLockLost(new Error("Lock ownership lost"));
          return;
        }
      } catch (error) {
        stopped = true;
        rejectLockLost(error as Error);
        return;
      }

      await sleep(5_000);

      await renew();
    };

    void renew();

    return {
      stop,
      lockLost,
    };
  }

  private async acquireLock(lockKey: string): Promise<string | null> {
    const client = this.redisService.getClient();
    const lockToken = randomUUID();

    const lockAcquired = await client.set(lockKey, lockToken, {
      NX: true,
      PX: 10_000,
    });

    return lockAcquired ? lockToken : null;
  }

  async findById(id: string): Promise<Product | null> {
    const client = this.redisService.getClient();
    const cacheKey = `product:${id}`;
    const lockKey = `lock:${cacheKey}`;

    // 1. Initial Cache Check
    const cachedProduct = await client.get(cacheKey);

    if (cachedProduct !== null) {
      console.log("Cache HIT");
      return JSON.parse(cachedProduct) as Product;
    }

    console.log("Cache MISS");

    const waitStartedAt = Date.now();

    while (Date.now() - waitStartedAt < MAX_WAIT_MS) {
      let originalError: Error | null = null;

      const lockToken = await this.acquireLock(lockKey);

      const lockAcquired = lockToken !== null;

      if (!lockAcquired) {
        await sleep(RETRY_DELAY_MS);

        const cachedProductAfterWait = await client.get(cacheKey);

        if (cachedProductAfterWait !== null) {
          console.log("Cache HIT AFTER WAIT");
          return JSON.parse(cachedProductAfterWait) as Product;
        }

        continue;
      }

      const renewal = await this.startLockRenewal(lockKey, lockToken!);

      try {
        // 3. Double-check the cache after acquiring the lock
        const cachedProductAfterLock = await client.get(cacheKey);

        if (cachedProductAfterLock !== null) {
          return JSON.parse(cachedProductAfterLock) as Product;
        }

        // 4. Load product from the source
        const product = await Promise.race([
          this.loadProduct(id),
          renewal.lockLost,
        ]);

        if (!product) {
          return null;
        }

        const result = await client.eval(SET_CACHE_IF_LOCK_OWNED_SCRIPT, {
          keys: [lockKey, cacheKey],
          arguments: [lockToken, JSON.stringify(product), "30"],
        });

        if (result === 0) {
          throw new Error("Lock ownership lost");
        }

        return product;
      } catch (error) {
        originalError = error as Error;
        throw error;
      } finally {
        // 6. Release only our own lock
        renewal.stop();

        try {
          await client.eval(RELEASE_LOCK_SCRIPT, {
            keys: [lockKey],
            arguments: [lockToken],
          });
        } catch (cleanupError) {
          if (originalError) {
            console.error("Original error:", originalError);
            console.error("Cleanup error:", cleanupError);
          } else {
            console.error("Failed to release lock:", cleanupError);
            throw cleanupError;
          }
        }
      }
    }

    // No cache value appeared and all lock attempts failed.
    throw new ServiceUnavailableException(
      "Product cache is not ready. Please try again.",
    );
  }

  async update(id: string, newPrice: number): Promise<Product | null> {
    const client = this.redisService.getClient();
    const cacheKey = `product:${id}`;
    const lockKey = `lock:${cacheKey}`;

    const lockToken = await this.acquireLock(lockKey);

    if (!lockToken) {
      throw new ServiceUnavailableException(
        "Product cache is not ready. Please try again.",
      );
    }

    const renewal = await this.startLockRenewal(lockKey, lockToken);

    let originalError: Error | null = null;

    try {
      const product = await Promise.race([
        this.loadProduct(id),
        renewal.lockLost,
      ]);

      if (!product) {
        return null;
      }

      const result = await client.eval(DELETE_CACHE_IF_LOCK_OWNED_SCRIPT, {
        keys: [lockKey, cacheKey],
        arguments: [lockToken],
      });

      if (result === 0) {
        throw new Error("Lock ownership lost");
      }

      product.price = newPrice;

      return product;
    } catch (error) {
      originalError = error as Error;
      throw error;
    } finally {
      renewal.stop();

      try {
        await client.eval(RELEASE_LOCK_SCRIPT, {
          keys: [lockKey],
          arguments: [lockToken],
        });
      } catch (cleanupError) {
        if (originalError) {
          console.error("Original error:", originalError);
          console.error("Cleanup error:", cleanupError);
        } else {
          throw cleanupError;
        }
      }
    }
  }
}
