/*
  Warnings:

  - Added the required column `product_type` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "product_type" AS ENUM ('ticket', 'merchandise');

-- DropIndex
DROP INDEX "products_publication_status_idx";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "is_orderable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "product_type" "product_type" NOT NULL,
ADD COLUMN     "published_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_product_type_idx" ON "products"("product_type");

-- CreateIndex
CREATE INDEX "products_publication_status_deleted_at_published_at_idx" ON "products"("publication_status", "deleted_at", "published_at");
