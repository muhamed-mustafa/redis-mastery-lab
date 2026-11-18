import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service.js";
import { FIXED_WINDOW_SCRIPT } from "../rate-limiting.scripts.js";
import {
  buildRateLimitKey,
  getRemainingWindowMs,
  getWindowId,
} from "../rate-limiting.utils.js";

@Injectable()
export class FixedWindowService {
  constructor(private readonly redisService: RedisService) {}

  async increment(
    userId: string,
    now: number,
    windowMs: number,
  ): Promise<number> {
    const key = buildRateLimitKey("user", userId, getWindowId(now, windowMs));
    const client = this.redisService.getClient();
    const count = await client.eval(FIXED_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [String(getRemainingWindowMs(now, windowMs))],
    });

    return Number(count);
  }

  async checkRateLimit(
    userId: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Promise<boolean> {
    const count = await this.increment(userId, now, windowMs);
    return count <= limit;
  }
}
