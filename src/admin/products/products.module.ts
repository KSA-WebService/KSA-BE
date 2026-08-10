import { Module } from '@nestjs/common';

import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { PublicProductsController } from './public-products.controller';

@Module({
  controllers: [ProductsController, PublicProductsController],
  providers: [ProductsService],
})
export class AdminProductsModule {}
