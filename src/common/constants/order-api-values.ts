import { OrderStatus } from '@prisma/client';

export enum OrderStatusValue {
  ORDERED = 'ordered',
  ACCEPTED = 'accepted',
  DELIVERED = 'delivered',
  CANCELED = 'canceled',
}

export const ORDER_STATUS_VALUE_MAP: Record<OrderStatus, OrderStatusValue> = {
  [OrderStatus.ORDERED]: OrderStatusValue.ORDERED,
  [OrderStatus.ACCEPTED]: OrderStatusValue.ACCEPTED,
  [OrderStatus.DELIVERED]: OrderStatusValue.DELIVERED,
  [OrderStatus.CANCELED]: OrderStatusValue.CANCELED,
};
