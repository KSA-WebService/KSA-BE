import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { ProductsService } from './products.service';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';

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
}
