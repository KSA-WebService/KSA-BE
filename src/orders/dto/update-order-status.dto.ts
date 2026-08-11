import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const ADMIN_ORDER_STATUS_UPDATE_VALUES = [
  'accepted',
  'delivered',
  'canceled',
] as const;

export type AdminOrderStatusUpdate =
  (typeof ADMIN_ORDER_STATUS_UPDATE_VALUES)[number];

export class UpdateOrderStatusDto {
  @IsIn(ADMIN_ORDER_STATUS_UPDATE_VALUES)
  orderStatus!: AdminOrderStatusUpdate;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cancellationReason?: string;
}
