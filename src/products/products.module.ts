import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';

@Module({
  imports: [RedisModule],
  controllers: [ProductsController],
  providers: [ProductsService]
})
export class ProductsModule {}
