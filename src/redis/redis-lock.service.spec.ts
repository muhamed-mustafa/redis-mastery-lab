import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RELEASE_LOCK_SCRIPT,
  RENEW_LOCK_SCRIPT,
} from "./redis-lock.scripts.js";
import { RedisLockService } from "./redis-lock.service.js";
import { RedisService } from "./redis.service.js";

describe("RedisLockService", () => {
  let service: RedisLockService;
  let mockSet: ReturnType<typeof vi.fn>;
  let mockEval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSet = vi.fn().mockResolvedValue("OK");
    mockEval = vi.fn().mockResolvedValue(1);
    const mockRedisService = {
      getClient: vi.fn().mockReturnValue({ set: mockSet, eval: mockEval }),
    };

    service = new RedisLockService(mockRedisService as unknown as RedisService);
  });

  it("acquires the lock with a unique token and the existing expiry", async () => {
    const lockToken = await service.acquire("lock:product:1");

    expect(lockToken).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mockSet).toHaveBeenCalledWith("lock:product:1", lockToken, {
      NX: true,
      PX: 10_000,
    });
  });

  it("returns null when the lock is already held", async () => {
    mockSet.mockResolvedValue(null);

    await expect(service.acquire("lock:product:1")).resolves.toBeNull();
  });

  it("renews at the existing interval using the ownership-checking script", async () => {
    vi.useFakeTimers();

    try {
      const renewal = await service.startRenewal("lock:product:1", "token-1");

      await vi.advanceTimersByTimeAsync(5_000);

      expect(mockEval).toHaveBeenCalledWith(RENEW_LOCK_SCRIPT, {
        keys: ["lock:product:1"],
        arguments: ["token-1", "10000"],
      });

      renewal.stop();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockEval).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports lost ownership when Redis no longer matches the token", async () => {
    vi.useFakeTimers();
    mockEval.mockResolvedValue(0);

    try {
      const renewal = await service.startRenewal("lock:product:1", "token-1");
      const lostAssertion = expect(renewal.lockLost).rejects.toThrow(
        "Lock ownership lost",
      );

      await vi.advanceTimersByTimeAsync(5_000);
      await lostAssertion;
      expect(() => renewal.assertNotLost()).toThrow("Lock ownership lost");
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats a Redis renewal error as lost ownership", async () => {
    vi.useFakeTimers();
    const redisError = new Error("Redis unavailable");
    mockEval.mockRejectedValue(redisError);

    try {
      const renewal = await service.startRenewal("lock:product:1", "token-1");
      const lostAssertion = expect(renewal.lockLost).rejects.toBe(redisError);

      await vi.advanceTimersByTimeAsync(5_000);
      await lostAssertion;
      expect(() => renewal.assertNotLost()).toThrow(redisError);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockEval).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels a pending renewal timer when stopped", async () => {
    vi.useFakeTimers();

    try {
      const renewal = await service.startRenewal("lock:product:1", "token-1");
      renewal.stop();

      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockEval).not.toHaveBeenCalled();
      await expect(
        Promise.race([renewal.lockLost, Promise.resolve("renewal stopped")]),
      ).resolves.toBe("renewal stopped");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not schedule another renewal when stopped during an in-flight renewal", async () => {
    vi.useFakeTimers();
    let resolveRenewal!: (result: number) => void;
    mockEval.mockReturnValue(
      new Promise<number>((resolve) => {
        resolveRenewal = resolve;
      }),
    );

    try {
      const renewal = await service.startRenewal("lock:product:1", "token-1");
      await vi.advanceTimersByTimeAsync(5_000);
      renewal.stop();
      resolveRenewal(1);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(10_000);

      expect(mockEval).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("releases only through the ownership-checking script", async () => {
    await service.release("lock:product:1", "token-1");

    expect(mockEval).toHaveBeenCalledWith(RELEASE_LOCK_SCRIPT, {
      keys: ["lock:product:1"],
      arguments: ["token-1"],
    });
  });
});
