import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetMyOrdersQueryDto } from './dto/get-my-orders-query.dto';
import { OrdersService } from './orders.service';

type AuthenticatedUserRequest = {
  user: {
    id: string;
  };
};

@Controller('users/me/orders')
@UseGuards(SupabaseAuthGuard)
export class UserOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getMyOrders(
    @Req() request: AuthenticatedUserRequest,
    @Query() query: GetMyOrdersQueryDto,
  ) {
    return this.ordersService.getMyOrders(request.user.id, query);
  }
}
