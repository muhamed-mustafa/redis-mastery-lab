import { beforeEach, describe, expect, it, vi } from "vitest";
import { RedisService } from "../../redis/redis.service.js";
import { IP_USER_RATE_LIMIT_SCRIPT } from "../rate-limiting.scripts.js";
import { IpUserRateLimitService } from "./ip-user-rate-limit.service.js";

describe("IpUserRateLimitService", () => {
  let service: IpUserRateLimitService;
  let mockEval: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEval = vi.fn().mockResolvedValue(1);
    const mockRedisService = {
      getClient: vi.fn().mockReturnValue({ eval: mockEval }),
    };
    service = new IpUserRateLimitService(
      mockRedisService as unknown as RedisService,
    );
  });

  it("passes IP and user keys together to the atomic script", async () => {
    await expect(
      service.checkRateLimit("127.0.0.1", "user-1", 10_000, 60_000, 100, 50),
    ).resolves.toBe(true);

    expect(mockEval).toHaveBeenCalledWith(IP_USER_RATE_LIMIT_SCRIPT, {
      keys: ["rate-limit:ip:127.0.0.1:0", "rate-limit:user:user-1:0"],
      arguments: ["100", "50", "50000"],
    });
  });

  it("returns false when either limit rejects a request", async () => {
    mockEval.mockResolvedValue(0);

    await expect(
      service.checkRateLimit("127.0.0.1", "user-1", 10_000, 60_000, 100, 50),
    ).resolves.toBe(false);
  });
});
