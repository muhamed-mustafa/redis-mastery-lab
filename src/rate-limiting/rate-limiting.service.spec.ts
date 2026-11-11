import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../redis/redis.service.js";
import { FIXED_WINDOW_SCRIPT } from "./rate-limiting.scripts.js";
import { RateLimitingService } from "./rate-limiting.service.js";

describe("RateLimitingService", () => {
  let service: RateLimitingService;

  let mockEval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEval = vi.fn().mockResolvedValue(1);
    const mockRedisService = {
      getClient: vi.fn().mockReturnValue({
        eval: mockEval,
      }),
    };

    service = new RateLimitingService(
      mockRedisService as unknown as RedisService,
    );
  });

  it("is defined", () => {
    expect(service).toBeDefined();
  });

  it("should generate the same key within the same window", () => {
    const key1 = service.buildRateLimitKey("123", 10_000, 60_000);
    const key2 = service.buildRateLimitKey("123", 50_000, 60_000);

    expect(key1).toBe(key2);
  });

  it("should allow requests within the limit", async () => {
    vi.spyOn(service, "increment").mockResolvedValue(3);

    const allowed = await service.checkRateLimit("123", 10_000, 60_000, 5);

    expect(allowed).toBe(true);
  });

  it("should block requests exceeding the limit", async () => {
    vi.spyOn(service, "increment").mockResolvedValue(6);

    const allowed = await service.checkRateLimit("123", 10_000, 60_000, 5);

    expect(allowed).toBe(false);
  });

  it("should return the Redis counter value", async () => {
    const count = await service.increment("123", 10_000, 60_000);
    expect(count).toBe(1);
    expect(mockEval).toHaveBeenCalledWith(FIXED_WINDOW_SCRIPT, {
      keys: ["rate-limit:user:123:0"],
      arguments: ["50000"],
    });
  });
});
