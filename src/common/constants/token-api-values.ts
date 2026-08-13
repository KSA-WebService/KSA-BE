import { TokenTransactionType } from '@prisma/client';

export enum TokenTransactionTypeValue {
  EVENT_GRANT = 'event_grant',
  EVENT_ADJUSTMENT = 'event_adjustment',
  ORDER_PAYMENT = 'order_payment',
  ORDER_REFUND = 'order_refund',
  RESET = 'reset',
}

export const TOKEN_TRANSACTION_TYPE_VALUE_MAP: Record<
  TokenTransactionType,
  TokenTransactionTypeValue
> = {
  [TokenTransactionType.EVENT_GRANT]: TokenTransactionTypeValue.EVENT_GRANT,
  [TokenTransactionType.EVENT_ADJUSTMENT]:
    TokenTransactionTypeValue.EVENT_ADJUSTMENT,
  [TokenTransactionType.ORDER_PAYMENT]: TokenTransactionTypeValue.ORDER_PAYMENT,
  [TokenTransactionType.ORDER_REFUND]: TokenTransactionTypeValue.ORDER_REFUND,
  [TokenTransactionType.RESET]: TokenTransactionTypeValue.RESET,
};

export enum TokenGrantStatusValue {
  ALL = 'all',
  GRANTED = 'granted',
  NOT_GRANTED = 'not_granted',
}

export enum TokenGrantEligibilityValue {
  ELIGIBLE = 'eligible',
  ADJUSTMENT_ONLY = 'adjustment_only',
}

export enum SaveTokenGrantStatusValue {
  CREATED = 'created',
  UPDATED = 'updated',
  UNCHANGED = 'unchanged',
}
