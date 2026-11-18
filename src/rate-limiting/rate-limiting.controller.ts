import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  DEFAULT_RATE_LIMIT,
  IP_RATE_LIMIT,
  RATE_LIMIT_WINDOW_MS,
  USER_RATE_LIMIT,
} from "./rate-limiting.constants.js";
import { FixedWindowService } from "./services/fixed-window.service.js";
import { IpUserRateLimitService } from "./services/ip-user-rate-limit.service.js";
import { SlidingWindowCounterService } from "./services/sliding-window-counter.service.js";
import { SlidingWindowLogService } from "./services/sliding-window-log.service.js";

@Controller("rate-limiting")
export class RateLimitingController {
  constructor(
    private readonly fixedWindowService: FixedWindowService,
    private readonly slidingWindowLogService: SlidingWindowLogService,
    private readonly slidingWindowCounterService: SlidingWindowCounterService,
    private readonly ipUserRateLimitService: IpUserRateLimitService,
  ) {}

  @Get("test")
  async test(@Req() req: Request): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    const allowed = await this.fixedWindowService.checkRateLimit(
      userId,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT,
    );

    return this.respond(allowed);
  }

  @Get("sliding-window-log")
  async slidingWindowLog(@Req() req: Request): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    const allowed = await this.slidingWindowLogService.checkRateLimit(
      userId,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT,
    );

    return this.respond(allowed);
  }

  @Get("sliding-window-counter")
  async slidingWindowCounter(
    @Req() req: Request,
  ): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    const allowed = await this.slidingWindowCounterService.checkRateLimit(
      userId,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT,
    );

    return this.respond(allowed);
  }

  @Get("ip-user")
  async ipUser(@Req() req: Request): Promise<{ message: string }> {
    const userId = this.getUserId(req);
    const ip = req.ip;

    if (!ip) {
      throw new BadRequestException("Client IP not found");
    }

    const allowed = await this.ipUserRateLimitService.checkRateLimit(
      ip,
      userId,
      Date.now(),
      RATE_LIMIT_WINDOW_MS,
      IP_RATE_LIMIT,
      USER_RATE_LIMIT,
    );

    return this.respond(allowed);
  }

  private getUserId(req: Request): string {
    const userId = req.headers["x-user-id"];

    if (typeof userId !== "string" || !userId.trim()) {
      throw new BadRequestException("User ID not found");
    }

    return userId.trim();
  }

  private respond(allowed: boolean): { message: string } {
    if (!allowed) {
      throw new HttpException(
        "Rate limit exceeded",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return { message: "Request successful" };
  }
}
