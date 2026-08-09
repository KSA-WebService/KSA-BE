import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

type AuthenticatedAdminRequest = {
  user: {
    id: string;
  };
};

@Controller('admin/products')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  async createProduct(
    @Body() dto: CreateProductDto,
    @Req()
    request: AuthenticatedAdminRequest,
  ) {
    return this.productsService.createProduct(dto, request.user.id);
  }

  @Get()
  async getProductList(@Query() query: ListProductsQueryDto) {
    return this.productsService.getProductList(query);
  }

  @Get(':productId')
  async getProductDetail(
    @Param('productId', new ParseUUIDPipe({ version: '4' }))
    productId: string,
  ) {
    return this.productsService.getProductDetail(productId);
  }
}
