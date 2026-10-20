import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductsService } from "./products.service.js";
import { RedisService } from "../redis/redis.service.js";

describe("ProductsService", () => {
  let service: ProductsService;

  const redisClient = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    eval: vi.fn().mockResolvedValue(1),
  };

  const redisService = {
    getClient: vi.fn(() => redisClient),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    redisClient.get.mockResolvedValue(null);

    service = new ProductsService(redisService as unknown as RedisService);
  });

  it("returns the product from cache on a cache hit", async () => {
    const cachedProduct = {
      id: "1",
      name: "Keyboard",
      price: 1200,
    };

    redisClient.get.mockResolvedValue(JSON.stringify(cachedProduct));

    const result = await service.findById("1");

    expect(result).toEqual(cachedProduct);

    expect(redisClient.get).toHaveBeenCalledWith("product:1");

    expect(redisClient.set).not.toHaveBeenCalled();
  });

  it("loads the product from source and caches it on a cache miss", async () => {
    const product = {
      id: "1",
      name: "Keyboard",
      price: 1200,
    };

    redisClient.set.mockResolvedValue("OK");

    const result = await service.findById("1");

    expect(result).toEqual(product);

    expect(redisClient.get).toHaveBeenCalledWith("product:1");

    expect(redisClient.set).toHaveBeenCalledWith(
      "product:1",
      JSON.stringify(product),
      { EX: 30 },
    );
  });

  it("returns null and does not cache a missing product", async () => {
    redisClient.get.mockResolvedValue(null);

    redisClient.set.mockResolvedValue("OK");

    const result = await service.findById("999");

    expect(result).toBeNull();

    expect(redisClient.set).toHaveBeenCalledWith(
      "lock:product:999",
      expect.any(String),
      { NX: true, PX: 10_000 },
    );

    expect(redisClient.set).not.toHaveBeenCalledWith(
      "product:999",
      expect.any(String),
      { EX: 30 },
    );
  });

  it("updates the product price in the source", async () => {
    const result = await service.update("1", 1500);

    expect(result).toEqual({
      id: "1",
      name: "Keyboard",
      price: 1500,
    });

    expect(redisClient.del).toHaveBeenCalledWith("product:1");
  });

  it("returns the updated price after cache invalidation", async () => {
    redisClient.set.mockResolvedValue("OK");

    await service.update("1", 1500);

    const result = await service.findById("1");

    expect(result).toEqual({
      id: "1",
      name: "Keyboard",
      price: 1500,
    });

    expect(redisClient.del).toHaveBeenCalledWith("product:1");

    expect(redisClient.set).toHaveBeenCalledWith(
      "product:1",
      JSON.stringify({
        id: "1",
        name: "Keyboard",
        price: 1500,
      }),
      { EX: 30 },
    );
  });
});
