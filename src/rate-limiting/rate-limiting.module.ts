import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module.js";
import { RateLimitingController } from "./rate-limiting.controller.js";
import { FixedWindowService } from "./services/fixed-window.service.js";
import { IpUserRateLimitService } from "./services/ip-user-rate-limit.service.js";
import { SlidingWindowCounterService } from "./services/sliding-window-counter.service.js";
import { SlidingWindowLogService } from "./services/sliding-window-log.service.js";

@Module({
  imports: [RedisModule],
  controllers: [RateLimitingController],
  providers: [
    FixedWindowService,
    SlidingWindowLogService,
    SlidingWindowCounterService,
    IpUserRateLimitService,
  ],
})
export class RateLimitingModule {}
