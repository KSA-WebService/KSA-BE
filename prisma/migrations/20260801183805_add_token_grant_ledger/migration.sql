/*
  Warnings:

  - You are about to drop the column `after_value` on the `token_logs` table. All the data in the column will be lost.
  - You are about to drop the column `before_value` on the `token_logs` table. All the data in the column will be lost.
  - You are about to drop the column `token_event_id` on the `token_logs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[order_id]` on the table `token_logs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `balance_after` to the `token_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `balance_before` to the `token_logs` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transaction_type` to the `token_logs` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "token_transaction_type" AS ENUM ('event_grant', 'event_adjustment', 'order_payment');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "admin_action" ADD VALUE 'update_token_event';
ALTER TYPE "admin_action" ADD VALUE 'update_token_grant';

-- DropForeignKey
ALTER TABLE "token_logs" DROP CONSTRAINT "token_logs_token_event_id_fkey";

-- DropIndex
DROP INDEX "token_logs_token_event_id_idx";

-- DropIndex
DROP INDEX "token_logs_user_id_idx";

-- AlterTable
ALTER TABLE "token_events" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "token_logs" DROP COLUMN "after_value",
DROP COLUMN "before_value",
DROP COLUMN "token_event_id",
ADD COLUMN     "balance_after" INTEGER NOT NULL,
ADD COLUMN     "balance_before" INTEGER NOT NULL,
ADD COLUMN     "order_id" UUID,
ADD COLUMN     "token_grant_id" UUID,
ADD COLUMN     "transaction_type" "token_transaction_type" NOT NULL,
ALTER COLUMN "admin_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "token_grants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "granted_by" UUID NOT NULL,
    "granted_amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "token_grants_user_id_idx" ON "token_grants"("user_id");

-- CreateIndex
CREATE INDEX "token_grants_granted_by_idx" ON "token_grants"("granted_by");

-- CreateIndex
CREATE INDEX "token_grants_token_event_id_granted_amount_idx" ON "token_grants"("token_event_id", "granted_amount");

-- CreateIndex
CREATE UNIQUE INDEX "token_grants_token_event_id_user_id_key" ON "token_grants"("token_event_id", "user_id");

-- CreateIndex
CREATE INDEX "token_events_deleted_at_idx" ON "token_events"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "token_logs_order_id_key" ON "token_logs"("order_id");

-- CreateIndex
CREATE INDEX "token_logs_user_id_created_at_idx" ON "token_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "token_logs_token_grant_id_idx" ON "token_logs"("token_grant_id");

-- CreateIndex
CREATE INDEX "token_logs_transaction_type_idx" ON "token_logs"("transaction_type");

-- AddForeignKey
ALTER TABLE "token_grants" ADD CONSTRAINT "token_grants_token_event_id_fkey" FOREIGN KEY ("token_event_id") REFERENCES "token_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_grants" ADD CONSTRAINT "token_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_grants" ADD CONSTRAINT "token_grants_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_logs" ADD CONSTRAINT "token_logs_token_grant_id_fkey" FOREIGN KEY ("token_grant_id") REFERENCES "token_grants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_logs" ADD CONSTRAINT "token_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE "users"
ADD CONSTRAINT "users_token_balance_nonnegative"
CHECK ("token_balance" >= 0);

ALTER TABLE "token_grants"
ADD CONSTRAINT "token_grants_granted_amount_nonnegative"
CHECK ("granted_amount" >= 0);

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_balance_nonnegative"
CHECK (
  "balance_before" >= 0
  AND "balance_after" >= 0
);

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_delta_matches_balance"
CHECK (
  "balance_after" - "balance_before" = "delta"
);

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_source_matches_transaction_type"
CHECK (
  (
    "transaction_type" IN ('event_grant', 'event_adjustment')
    AND "token_grant_id" IS NOT NULL
    AND "order_id" IS NULL
    AND "admin_id" IS NOT NULL
  )
  OR
  (
    "transaction_type" = 'order_payment'
    AND "token_grant_id" IS NULL
    AND "order_id" IS NOT NULL
    AND "admin_id" IS NULL
  )
);

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
);

