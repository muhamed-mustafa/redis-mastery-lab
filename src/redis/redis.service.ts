import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType = createClient({
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  });

  async onModuleInit(): Promise<void> {
    this.client.on("error", (error: Error) => {
      console.error("Redis Client Error:", error);
    });

    await this.client.connect();

    console.log("Redis client connected");
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }
}
