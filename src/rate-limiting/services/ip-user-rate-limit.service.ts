import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service.js";
import { IP_USER_RATE_LIMIT_SCRIPT } from "../rate-limiting.scripts.js";
import {
  buildRateLimitKey,
  getRemainingWindowMs,
  getWindowId,
} from "../rate-limiting.utils.js";

@Injectable()
export class IpUserRateLimitService {
  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    ip: string,
    userId: string,
    now: number,
    windowMs: number,
    ipLimit: number,
    userLimit: number,
  ): Promise<boolean> {
    const windowId = getWindowId(now, windowMs);
    const ipKey = buildRateLimitKey("ip", ip, windowId);
    const userKey = buildRateLimitKey("user", userId, windowId);
    const remainingMs = getRemainingWindowMs(now, windowMs);
    const result = await this.redisService
      .getClient()
      .eval(IP_USER_RATE_LIMIT_SCRIPT, {
        keys: [ipKey, userKey],
        arguments: [String(ipLimit), String(userLimit), String(remainingMs)],
      });

    return Number(result) === 1;
  }
}
