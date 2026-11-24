import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module.js";
import { PubSubService } from "./pub-sub.service.js";

@Module({
  imports: [RedisModule],
  providers: [PubSubService],
  exports: [PubSubService],
})
export class PubSubModule {}
