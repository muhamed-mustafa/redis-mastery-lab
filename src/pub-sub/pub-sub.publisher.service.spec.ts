import { randomUUID } from "node:crypto";
import { Test, type TestingModule } from "@nestjs/testing";
import type { RedisClientType } from "redis";
import { describe, expect, it } from "vitest";
import { PubSubModule } from "./pub-sub.module.js";
import { PubSubPublisherService } from "./pub-sub.publisher.service.js";
import { RedisService } from "../redis/redis.service.js";

const MESSAGE_TIMEOUT_MS = 5_000;

function waitWithTimeout<T>(promise: Promise<T>, eventName: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${eventName}`)),
      MESSAGE_TIMEOUT_MS,
    );
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

describe("PubSubPublisherService (Redis integration)", () => {
  it("publishes to a unique channel and receives the message", async () => {
    let testingModule: TestingModule | undefined;
    let testSubscriber: RedisClientType | undefined;

    try {
      testingModule = await Test.createTestingModule({
        imports: [PubSubModule],
      }).compile();

      await testingModule.init();

      const publisher = testingModule.get(PubSubPublisherService);
      const redisService = testingModule.get(RedisService);
      const channel = `test.order.created.${randomUUID()}`;
      const message = `integration-test-${randomUUID()}`;

      testSubscriber = redisService.getClient().duplicate();
      testSubscriber.on("error", (error: Error) => {
        console.error("Redis Pub/Sub test subscriber error:", error);
      });
      await testSubscriber.connect();

      let resolveTestSubscriber!: (receivedMessage: string) => void;
      const testSubscriberReceived = new Promise<string>((resolve) => {
        resolveTestSubscriber = resolve;
      });

      await testSubscriber.subscribe(channel, (receivedMessage) => {
        resolveTestSubscriber(receivedMessage);
      });

      const subscribersCount = await waitWithTimeout(
        publisher.publish(channel, message),
        "Redis publish",
      );
      expect(subscribersCount).toBe(1);
      await expect(
        waitWithTimeout(
          testSubscriberReceived,
          "the unique-channel subscriber message",
        ),
      ).resolves.toBe(message);
    } finally {
      try {
        if (testSubscriber?.isOpen) {
          await testSubscriber.quit();
        }
      } finally {
        await testingModule?.close();
      }
    }
  });
});
