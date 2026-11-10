import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module.js";
import { RateLimitingController } from "./rate-limiting.controller.js";
import { RateLimitingService } from "./rate-limiting.service.js";

@Module({
  imports: [RedisModule],
  controllers: [RateLimitingController],
  providers: [RateLimitingService],
})
export class RateLimitingModule {}
