import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../../redis/redis.service.js";
import { SLIDING_WINDOW_COUNTER_SCRIPT } from "../rate-limiting.scripts.js";
import { SlidingWindowCounterService } from "./sliding-window-counter.service.js";

describe("SlidingWindowCounterService", () => {
  let service: SlidingWindowCounterService;
  let mockEval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEval = vi.fn().mockResolvedValue(1);
    const mockRedisService = {
      getClient: vi.fn().mockReturnValue({ eval: mockEval }),
    };
    service = new SlidingWindowCounterService(
      mockRedisService as unknown as RedisService,
    );
  });

  it("passes the previous and current window keys and weighted count arguments", async () => {
    await expect(
      service.checkRateLimit("user-1", 75_000, 60_000, 5),
    ).resolves.toBe(true);

    expect(mockEval).toHaveBeenCalledWith(SLIDING_WINDOW_COUNTER_SCRIPT, {
      keys: ["rate-limit:user:user-1:0", "rate-limit:user:user-1:1"],
      arguments: ["0.75", "5", "120000"],
    });
  });

  it("returns false when the script rejects a request", async () => {
    mockEval.mockResolvedValue(0);

    await expect(
      service.checkRateLimit("user-1", 75_000, 60_000, 5),
    ).resolves.toBe(false);
  });
});
