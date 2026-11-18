import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../../redis/redis.service.js";
import { FIXED_WINDOW_SCRIPT } from "../rate-limiting.scripts.js";
import { buildRateLimitKey } from "../rate-limiting.utils.js";
import { FixedWindowService } from "./fixed-window.service.js";

describe("FixedWindowService", () => {
  let service: FixedWindowService;
  let mockEval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEval = vi.fn().mockResolvedValue(1);
    const mockRedisService = {
      getClient: vi.fn().mockReturnValue({ eval: mockEval }),
    };

    service = new FixedWindowService(
      mockRedisService as unknown as RedisService,
    );
  });

  it("builds the same key within a window", () => {
    const firstWindowId = Math.floor(10_000 / 60_000);
    const secondWindowId = Math.floor(50_000 / 60_000);

    expect(buildRateLimitKey("user", "123", firstWindowId)).toBe(
      buildRateLimitKey("user", "123", secondWindowId),
    );
  });

  it("allows requests within the limit", async () => {
    vi.spyOn(service, "increment").mockResolvedValue(3);

    await expect(
      service.checkRateLimit("123", 10_000, 60_000, 5),
    ).resolves.toBe(true);
  });

  it("blocks requests over the limit after incrementing the counter", async () => {
    const increment = vi.spyOn(service, "increment").mockResolvedValue(6);

    await expect(
      service.checkRateLimit("123", 10_000, 60_000, 5),
    ).resolves.toBe(false);
    expect(increment).toHaveBeenCalledWith("123", 10_000, 60_000);
  });

  it("returns the Redis counter and preserves the key and TTL argument", async () => {
    await expect(service.increment("123", 10_000, 60_000)).resolves.toBe(1);
    expect(mockEval).toHaveBeenCalledWith(FIXED_WINDOW_SCRIPT, {
      keys: ["rate-limit:user:123:0"],
      arguments: ["50000"],
    });
  });
});
