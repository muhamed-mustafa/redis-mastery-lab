import { Module } from "@nestjs/common";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { ProductsModule } from "./products/products.module.js";
import { PubSubModule } from "./pub-sub/pub-sub.module.js";
import { RateLimitingModule } from "./rate-limiting/rate-limiting.module.js";

@Module({
  imports: [ProductsModule, PubSubModule, RateLimitingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
