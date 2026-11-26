import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class PubSubPublisherService {
  constructor(private readonly redisService: RedisService) {}

  publish(channel: string, message: string): Promise<number> {
    return this.redisService.getClient().publish(channel, message);
  }
}
