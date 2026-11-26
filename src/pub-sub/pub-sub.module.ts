import { Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module.js";
import { PubSubPublisherService } from "./pub-sub.publisher.service.js";
import { PubSubService } from "./pub-sub.service.js";

@Module({
  imports: [RedisModule],
  providers: [PubSubService, PubSubPublisherService],
  exports: [PubSubService, PubSubPublisherService],
})
export class PubSubModule {}
