import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { RedisService } from "../redis/redis.service.js";
import { FIXED_WINDOW_SCRIPT } from "./rate-limiting.scripts.js";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

@Injectable()
export class RateLimitingService {
  constructor(private readonly redisService: RedisService) {}
  buildRateLimitKey(userId: string, now: number, windowMs: number): string {
    const windowId = Math.floor(now / windowMs);
    return `rate-limit:user:${userId}:${windowId}`;
  }

  private readonly slidingWindowLogScript = readFileSync(
    join(currentDir, "scripts", "sliding-window-log.lua"),
    "utf8",
  );

  async checkSlidingWindowLog(
    userId: string,
    now: number,
    windowMs: number,
    limit: number,
  ): Promise<boolean> {
    const windowStart = now - windowMs;
    const requestId = randomUUID();
    const key = `rate-limit:user:${userId}`;

    const client = this.redisService.getClient();

    const result = await client.eval(this.slidingWindowLogScript, {
      keys: [key],
      arguments: [
        String(windowStart),
        String(limit),
        String(now),
        requestId,
        String(windowMs),
      ],
    });

    return Number(result) === 1;
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
