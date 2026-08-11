import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const ADMIN_ORDER_STATUSES = [
  'ordered',
  'accepted',
  'delivered',
  'canceled',
] as const;

const ADMIN_ORDER_SORTS = ['latest', 'oldest'] as const;

export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

export type AdminOrderSort = (typeof ADMIN_ORDER_SORTS)[number];

export class GetAdminOrdersQueryDto {
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
  @IsString()
  @MaxLength(255)
  keyword?: string;

  @IsOptional()
  @IsIn(ADMIN_ORDER_STATUSES)
  orderStatus?: AdminOrderStatus;

  @IsOptional()
  @IsIn(ADMIN_ORDER_SORTS)
  sort: AdminOrderSort = 'latest';
}
