import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { ProductsService, type Product } from "./products.service.js";

@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get(":id")
  async findById(@Param("id") id: string): Promise<Product> {
    const product = await this.productsService.findById(id);

    if (!product) {
      throw new NotFoundException("Product not found");
    }

    return product;
  }
}
