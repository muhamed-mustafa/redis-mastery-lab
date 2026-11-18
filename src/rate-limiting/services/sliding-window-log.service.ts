import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { RedisService } from "../../redis/redis.service.js";
import { SLIDING_WINDOW_LOG_SCRIPT } from "../rate-limiting.scripts.js";

@Injectable()
export class SlidingWindowLogService {
  constructor(private readonly redisService: RedisService) {}

  async checkRateLimit(
    userId: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Promise<boolean> {
    const windowStart = now - windowMs;
    const key = `rate-limit:user:${userId}`;
    const result = await this.redisService
      .getClient()
      .eval(SLIDING_WINDOW_LOG_SCRIPT, {
        keys: [key],
        arguments: [
          String(windowStart),
          String(limit),
          String(now),
          randomUUID(),
          String(windowMs),
        ],
      });

    return Number(result) === 1;
  }
}
