import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../../redis/redis.service.js";
import { SLIDING_WINDOW_LOG_SCRIPT } from "../rate-limiting.scripts.js";
import { SlidingWindowLogService } from "./sliding-window-log.service.js";

describe("SlidingWindowLogService", () => {
  let service: SlidingWindowLogService;
  let mockEval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEval = vi.fn().mockResolvedValue(1);
    const mockRedisService = {
      getClient: vi.fn().mockReturnValue({ eval: mockEval }),
    };
    service = new SlidingWindowLogService(
      mockRedisService as unknown as RedisService,
    );
  });

  it("passes the log key and ordered window arguments to the atomic script", async () => {
    await expect(
      service.checkRateLimit("user-1", 75_000, 60_000, 5),
    ).resolves.toBe(true);

    expect(mockEval).toHaveBeenCalledWith(SLIDING_WINDOW_LOG_SCRIPT, {
      keys: ["rate-limit:user:user-1"],
      arguments: ["15000", "5", "75000", expect.any(String), "60000"],
    });
  });

  it("returns false when the script rejects a request", async () => {
    mockEval.mockResolvedValue(0);

    await expect(
      service.checkRateLimit("user-1", 75_000, 60_000, 5),
    ).resolves.toBe(false);
  });
});
