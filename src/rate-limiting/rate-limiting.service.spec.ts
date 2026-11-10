import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../redis/redis.service.js";
import { RateLimitingService } from "./rate-limiting.service.js";

describe("RateLimitingService", () => {
  let service: RateLimitingService;

  beforeEach(() => {
    service = new RateLimitingService({} as unknown as RedisService);
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
});
