import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { RedisClientType } from "redis";
import { RedisService } from "../redis/redis.service.js";

@Injectable()
export class PubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly subscriber: RedisClientType;

  constructor(private readonly redisService: RedisService) {
    this.subscriber = this.redisService.getClient().duplicate();
  }

  async onModuleInit(): Promise<void> {
    this.subscriber.on("error", (error: Error) => {
      console.error("Redis Pub/Sub Subscriber Error:", error);
    });

    await this.subscriber.connect();

    await this.subscriber.subscribe("order.created", (message) => {
      console.log("Received order event:", message);
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.subscriber.isOpen) {
      await this.subscriber.quit();
    }
  }
}
