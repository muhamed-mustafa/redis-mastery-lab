import { Injectable } from "@nestjs/common";
import products from "../../data/products.json" with { type: "json" };
import { RedisService } from "../redis/redis.service.js";

export interface Product {
  id: string;
  name: string;
  price: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly redisService: RedisService) {}

  async findById(id: string): Promise<Product | null> {
    const client = this.redisService.getClient();
    const cacheKey = `product:${id}`;

    const cachedProduct = await client.get(cacheKey);

    // Cache Hit
    if (cachedProduct !== null) {
      console.log("Cache HIT");
      return JSON.parse(cachedProduct) as Product;
    }

    // Cache Miss
    console.log("Cache MISS");

    const product = products.find((item) => item.id === id);

    if (!product) {
      return null;
    }

    // Store product in Redis
    await client.set(cacheKey, JSON.stringify(product), {
      EX: 30,
    });

    return product;
  }
}
