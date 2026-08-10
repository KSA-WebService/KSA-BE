/*
  Warnings:

  - A unique constraint covering the columns `[idempotency_key]` on the table `orders` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[order_id,transaction_type]` on the table `token_logs` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotency_key` to the `orders` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "order_status" ADD VALUE 'canceled';

-- AlterEnum
ALTER TYPE "token_transaction_type" ADD VALUE 'order_refund';

-- DropIndex
DROP INDEX "orders_status_idx";

-- DropIndex
DROP INDEX "orders_user_id_idx";

-- DropIndex
DROP INDEX "token_logs_order_id_key";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "canceled_at" TIMESTAMP(3),
ADD COLUMN     "cancellation_reason" VARCHAR(255),
ADD COLUMN     "idempotency_key" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_id_idx" ON "orders"("user_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "orders_status_created_at_id_idx" ON "orders"("status", "created_at", "id");

-- CreateIndex
CREATE INDEX "orders_created_at_id_idx" ON "orders"("created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "token_logs_order_id_transaction_type_key" ON "token_logs"("order_id", "transaction_type");
