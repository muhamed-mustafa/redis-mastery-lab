import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../redis/redis.service.js";
import { ProductsService } from "./products.service.js";

describe("ProductsService", () => {
  let service: ProductsService;

  const redisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    eval: vi.fn(),
  };

  const redisService = {
    getClient: vi.fn(() => redisClient),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    redisClient.get.mockResolvedValue(null);
    redisClient.eval.mockResolvedValue(1);

    service = new ProductsService(
      redisService as unknown as RedisService,
    );
  });

  it("returns the product from cache on a cache hit", async () => {
    const cachedProduct = {
      id: "1",
      name: "Keyboard",
      price: 1200,
    };

    redisClient.get.mockResolvedValue(
      JSON.stringify(cachedProduct),
    );

    const result = await service.findById("1");

    expect(result).toEqual(cachedProduct);
    expect(redisClient.get).toHaveBeenCalledWith("product:1");
    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it("loads the product from source and caches it on a cache miss", async () => {
    const product = {
      id: "1",
      name: "Keyboard",
      price: 1200,
    };

    redisClient.set.mockResolvedValue("OK");

    const result = await service.findById("1");

    expect(result).toEqual(product);
    expect(redisClient.set).toHaveBeenCalledWith(
      "product:1",
      JSON.stringify(product),
      { EX: 30 },
    );
  });

  it("returns null and does not cache a missing product", async () => {
    redisClient.set.mockResolvedValue("OK");

    const result = await service.findById("999");

    expect(result).toBeNull();

    expect(redisClient.set).toHaveBeenCalledWith(
      "lock:product:999",
      expect.any(String),
      { NX: true, PX: 10_000 },
    );

    expect(redisClient.set).not.toHaveBeenCalledWith(
      "product:999",
      expect.any(String),
      { EX: 30 },
    );
  });

  it("updates the product price in the source", async () => {
    const result = await service.update("1", 1500);

    expect(result).toEqual({
      id: "1",
      name: "Keyboard",
      price: 1500,
    });

    expect(redisClient.del).toHaveBeenCalledWith("product:1");
  });

  it("returns the updated price after cache invalidation", async () => {
    redisClient.set.mockResolvedValue("OK");

    await service.update("1", 1500);

    const result = await service.findById("1");

    expect(result).toEqual({
      id: "1",
      name: "Keyboard",
      price: 1500,
    });

    expect(redisClient.del).toHaveBeenCalledWith("product:1");
    expect(redisClient.set).toHaveBeenCalledWith(
      "product:1",
      JSON.stringify({
        id: "1",
        name: "Keyboard",
        price: 1500,
      }),
      { EX: 30 },
    );
  });

  it("allows only one request to acquire the lock", async () => {
    const lockKey = "lock:product:1";
    let lockToken: string | null = null;
    let cachedProduct: string | null = null;
    let lockAttempts = 0;
    let cacheWrites = 0;

    redisClient.get.mockImplementation(async (key: string) => {
      if (key === "product:1") {
        return cachedProduct;
      }

      return null;
    });

    redisClient.set.mockImplementation(
      async (
        key: string,
        value: string,
        options?: { NX?: boolean; PX?: number; EX?: number },
      ) => {
        if (key === lockKey && options?.NX === true) {
          lockAttempts++;

          if (lockToken !== null) {
            return null;
          }

          lockToken = value;
          return "OK";
        }

        if (key === "product:1") {
          cacheWrites++;
          cachedProduct = value;
          return "OK";
        }

        return null;
      },
    );

    redisClient.eval.mockImplementation(
      async (
        _script: string,
        options: { keys: string[]; arguments: string[] },
      ) => {
        if (lockToken !== options.arguments[0]) {
          return 0;
        }

        lockToken = null;
        return 1;
      },
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.findById("1")),
    );

    expect(results).toHaveLength(10);
    expect(results.every((product) => product?.id === "1")).toBe(true);
    expect(lockAttempts).toBeGreaterThan(1);
    expect(cacheWrites).toBe(1);
  });

  it("prevents multiple requests from loading the same product concurrently", async () => {
    const product = {
      id: "1",
      name: "Keyboard",
      price: 1200,
    };

    let lockToken: string | null = null;
    let cachedProduct: string | null = null;
    let cacheWrites = 0;

    redisClient.get.mockImplementation(async (key: string) => {
      if (key === "product:1") {
        return cachedProduct;
      }

      return null;
    });

    redisClient.set.mockImplementation(
      async (
        key: string,
        value: string,
        options?: { NX?: boolean; PX?: number; EX?: number },
      ) => {
        if (key === "lock:product:1" && options?.NX === true) {
          if (lockToken !== null) {
            return null;
          }

          lockToken = value;
          return "OK";
        }

        if (key === "product:1") {
          cacheWrites++;
          cachedProduct = value;
          return "OK";
        }

        return null;
      },
    );

    redisClient.eval.mockImplementation(
      async (
        _script: string,
        options: { keys: string[]; arguments: string[] },
      ) => {
        if (lockToken !== options.arguments[0]) {
          return 0;
        }

        lockToken = null;
        return 1;
      },
    );

    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.findById("1")),
    );

    expect(results).toEqual(Array(10).fill(product));
    expect(cacheWrites).toBe(1);
  });
});
