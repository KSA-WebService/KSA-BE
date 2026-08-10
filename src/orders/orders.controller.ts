import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

type AuthenticatedUserRequest = {
  user: {
    id: string;
  };
};

@Controller('orders')
@UseGuards(SupabaseAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async createOrder(
    @Body() body: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: AuthenticatedUserRequest,
  ) {
    const normalizedIdempotencyKey = idempotencyKey?.trim();

    if (!normalizedIdempotencyKey) {
      throw new BadRequestException({
        errorCode: 'O400_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      });
    }

    if (!isUUID(normalizedIdempotencyKey, '4')) {
      throw new BadRequestException({
        errorCode: 'O400_IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be a valid UUID v4',
      });
    }

    return this.ordersService.createOrder(
      body,
      request.user.id,
      normalizedIdempotencyKey,
    );
  }
}
