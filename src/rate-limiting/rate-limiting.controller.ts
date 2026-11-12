import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import { RateLimitingService } from "./rate-limiting.service.js";
@Controller("rate-limiting")
export class RateLimitingController {
  constructor(private readonly rateLimitingService: RateLimitingService) {}

  @Get("test")
  async test(@Req() req: Request): Promise<{ message: string }> {
    const userId = req.headers["x-user-id"] as string;

    if (typeof userId !== "string" || !userId.trim()) {
      throw new BadRequestException("User ID not found");
    }

    const normalizedUserId = userId.trim();
    const now = Date.now();
    const windowMs = 60_000;
    const limit = 5;

    const allowed = await this.rateLimitingService.checkRateLimit(
      normalizedUserId,
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
