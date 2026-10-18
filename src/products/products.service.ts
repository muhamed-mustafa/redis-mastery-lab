import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";

export interface Product {
  id: string;
  name: string;
  price: number;
}

@Injectable()
export class ProductsService {
  constructor(private readonly redisService: RedisService) {}

  private products: Product[] = [
    { id: "1", name: "Keyboard", price: 1200 },
    { id: "2", name: "Mouse", price: 500 },
  ];

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

    const product = this.products.find((product) => product.id === id);

    if (!product) {
      return null;
    }

    // Store product in Redis
    await client.set(cacheKey, JSON.stringify(product), {
      EX: 30,
    });

    return product;
  }

  async update(id: string, newPrice: number): Promise<Product | null> {
    const product = this.products.find((product) => product.id === id);

    if (!product) {
      return null;
    }

    product.price = newPrice;

    const client = this.redisService.getClient();

    await client.del(`product:${id}`);

    return product;
  }
}
