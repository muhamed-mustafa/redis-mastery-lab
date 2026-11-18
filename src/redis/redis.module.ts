import { Module } from "@nestjs/common";
import { RedisLockService } from "./redis-lock.service.js";
import { RedisService } from "./redis.service.js";

@Module({
  providers: [RedisService, RedisLockService],
  exports: [RedisService, RedisLockService],
})
export class RedisModule {}
