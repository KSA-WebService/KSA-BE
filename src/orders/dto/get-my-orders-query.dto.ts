import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const USER_ORDER_STATUSES = [
  'ordered',
  'accepted',
  'delivered',
  'canceled',
] as const;

const USER_ORDER_SORTS = ['latest', 'oldest'] as const;

export type UserOrderStatus = (typeof USER_ORDER_STATUSES)[number];
export type UserOrderSort = (typeof USER_ORDER_SORTS)[number];

export class GetMyOrdersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(USER_ORDER_STATUSES)
  orderStatus?: UserOrderStatus;

  @IsOptional()
  @IsIn(USER_ORDER_SORTS)
  sort: UserOrderSort = 'latest';
}
