import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RedisService } from "./redis.service.js";
import {
  RELEASE_LOCK_SCRIPT,
  RENEW_LOCK_SCRIPT,
} from "./redis-lock.scripts.js";

const LOCK_TTL_MS = 10_000;
const RENEWAL_INTERVAL_MS = 5_000;

@Injectable()
export class RedisLockService {
  constructor(private readonly redisService: RedisService) {}

  async acquire(lockKey: string): Promise<string | null> {
    const lockToken = randomUUID();
    const lockAcquired = await this.redisService
      .getClient()
      .set(lockKey, lockToken, {
        NX: true,
        PX: LOCK_TTL_MS,
      });

    return lockAcquired ? lockToken : null;
  }

  async startRenewal(
    lockKey: string,
    lockToken: string,
  ): Promise<{
    stop: () => void;
    lockLost: Promise<never>;
    assertNotLost: () => void;
  }> {
    let stopped = false;
    let failure: Error | null = null;
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    let rejectLockLost!: (error: Error) => void;

    const lockLost = new Promise<never>((_, reject) => {
      rejectLockLost = reject;
    });

    // Keep failures handled even when the protected operation finishes first.
    void lockLost.catch(() => {});

    const stop = (): void => {
      stopped = true;

      if (renewalTimer !== undefined) {
        clearTimeout(renewalTimer);
        renewalTimer = undefined;
      }
    };

    const loseLock = (error: Error): void => {
      if (stopped) return;

      failure = error;
      stop();
      rejectLockLost(error);
    };

    const scheduleRenewal = (): void => {
      if (stopped) return;

      renewalTimer = setTimeout(() => {
        renewalTimer = undefined;
        void renew();
      }, RENEWAL_INTERVAL_MS);
    };

    const renew = async (): Promise<void> => {
      if (stopped) return;

      try {
        const result = await this.redisService
          .getClient()
          .eval(RENEW_LOCK_SCRIPT, {
            keys: [lockKey],
            arguments: [lockToken, String(LOCK_TTL_MS)],
          });

        if (stopped) return;

        if (result === 0) {
          loseLock(new Error("Lock ownership lost"));
          return;
        }

        scheduleRenewal();
      } catch (error) {
        loseLock(error instanceof Error ? error : new Error(String(error)));
      }
    };

    scheduleRenewal();

    return {
      stop,
      lockLost,
      assertNotLost: () => {
        if (failure) throw failure;
      },
    };
  }

  async release(lockKey: string, lockToken: string): Promise<void> {
    await this.redisService.getClient().eval(RELEASE_LOCK_SCRIPT, {
      keys: [lockKey],
      arguments: [lockToken],
    });
  }
}
