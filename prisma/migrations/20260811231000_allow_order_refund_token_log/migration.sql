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
    "transaction_type" = 'order_refund'
    AND "delta" > 0
  )
  OR
  (
    "transaction_type" = 'reset'
    AND "delta" < 0
  )
);

ALTER TABLE "token_logs"
DROP CONSTRAINT "token_logs_source_matches_transaction_type";

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_source_matches_transaction_type"
CHECK (
  (
    "transaction_type" IN ('event_grant', 'event_adjustment')
    AND "token_grant_id" IS NOT NULL
    AND "order_id" IS NULL
  )
  OR
  (
    "transaction_type" IN ('order_payment', 'order_refund')
    AND "token_grant_id" IS NULL
    AND "order_id" IS NOT NULL
  )
  OR
  (
    "transaction_type" = 'reset'
    AND "token_grant_id" IS NULL
    AND "order_id" IS NULL
  )
);