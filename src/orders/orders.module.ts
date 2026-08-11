import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { UserOrdersController } from './user-orders.controller';
import { AdminOrdersController } from './admin-orders.controller';

@Module({
  controllers: [OrdersController, UserOrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
