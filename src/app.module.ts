import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { ProductsModule } from "./products/products.module.js";
import { RateLimitingModule } from "./rate-limiting/rate-limiting.module.js";

@Module({
  imports: [ProductsModule, RateLimitingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
