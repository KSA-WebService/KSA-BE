import {
  Controller,
  Get,
  Query,
  UseGuards,
  Body,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
} from '@nestjs/common';

import { AdminGuard } from '../auth/admin.guard';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders-query.dto';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

type AuthenticatedAdminRequest = {
  user: {
    id: string;
  };
};
@Controller('admin/orders')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getOrders(@Query() query: GetAdminOrdersQueryDto) {
    return this.ordersService.getAdminOrders(query);
  }

  @Patch(':orderId/status')
  updateOrderStatus(
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: UpdateOrderStatusDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.ordersService.updateOrderStatus(orderId, body, request.user.id);
  }
}
