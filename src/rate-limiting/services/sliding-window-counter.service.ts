import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service.js";
import { SLIDING_WINDOW_COUNTER_SCRIPT } from "../rate-limiting.scripts.js";
import { buildRateLimitKey, getWindowId } from "../rate-limiting.utils.js";

@Injectable()
export class SlidingWindowCounterService {
  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    userId: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Promise<boolean> {
    const windowId = getWindowId(now, windowMs);
    const previousKey = buildRateLimitKey("user", userId, windowId - 1);
    const currentKey = buildRateLimitKey("user", userId, windowId);
    const elapsed = now % windowMs;
    const previousWindowWeight = 1 - elapsed / windowMs;
    const ttl = windowMs * 2;
    const result = await this.redisService
      .getClient()
      .eval(SLIDING_WINDOW_COUNTER_SCRIPT, {
        keys: [previousKey, currentKey],
        arguments: [String(previousWindowWeight), String(limit), String(ttl)],
      });

    return Number(result) === 1;
  }
}
