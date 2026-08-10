import { Controller, Get, Query } from '@nestjs/common';

import { ListPublicProductsQueryDto } from './dto/list-public-products-query.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class PublicProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProductList(@Query() query: ListPublicProductsQueryDto) {
    return this.productsService.getPublicProductList(query);
  }
}
