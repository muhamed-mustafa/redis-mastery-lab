import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { RateLimitingService } from "./rate-limiting.service.js";
@Controller("rate-limiting")
export class RateLimitingController {
  constructor(private readonly rateLimitingService: RateLimitingService) {}

  @Get("test")
  async test() {
    const userId = "123";
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 5;

    const allowed = await this.rateLimitingService.checkRateLimit(
      userId,
      now,
      windowMs,
      limit,
    );

    if (!allowed) {
      throw new HttpException(
        "Rate limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return { message: "Request successful" };
  }
}
