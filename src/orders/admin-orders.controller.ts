import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders-query.dto';
import { OrdersService } from './orders.service';

@Controller('admin/orders')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getOrders(@Query() query: GetAdminOrdersQueryDto) {
    return this.ordersService.getAdminOrders(query);
  }
}
