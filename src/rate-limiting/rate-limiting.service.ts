import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";
import { FIXED_WINDOW_SCRIPT } from "./rate-limiting.scripts.js";
@Injectable()
export class RateLimitingService {
  constructor(private readonly redisService: RedisService) {}
  buildRateLimitKey(userId: string, now: number, windowMs: number): string {
    const windowId = Math.floor(now / windowMs);
    return `rate-limit:user:${userId}:${windowId}`;
  }

  private getRemainingMs(now: number, windowMs: number): number {
    return windowMs - (now % windowMs);
  }

  async increment(
    userId: string,
    now: number,
    windowMs: number,
  ): Promise<number> {
    const key = this.buildRateLimitKey(userId, now, windowMs);

    const remainingMs = this.getRemainingMs(now, windowMs);

    const client = this.redisService.getClient();

    const count = await client.eval(FIXED_WINDOW_SCRIPT, {
      keys: [key],
      arguments: [String(remainingMs)],
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
