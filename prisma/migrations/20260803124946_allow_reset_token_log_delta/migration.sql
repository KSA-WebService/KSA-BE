ALTER TABLE "token_logs"
DROP CONSTRAINT "token_logs_delta_matches_transaction_type";

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_delta_matches_transaction_type"
CHECK (
  (
    "transaction_type" = 'event_grant'
    AND "delta" > 0
  )
  OR
  (
    "transaction_type" = 'event_adjustment'
    AND "delta" <> 0
  )
  OR
  (
    "transaction_type" = 'order_payment'
    AND "delta" < 0
  )
  OR
  (
    "transaction_type" = 'reset'
    AND "delta" < 0
  )
);