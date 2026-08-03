/*
  Warnings:

  - The values [post image,product image,general attachment] on the enum `file_purpose` will be removed. If these variants are still used in the database, this will fail.
  - The values [failed] on the enum `file_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `image_url` on the `clubs` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storage_path]` on the table `files` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "admin_action" ADD VALUE 'upload_file';
ALTER TYPE "admin_action" ADD VALUE 'delete_file';

-- AlterEnum
ALTER TYPE "admin_action_type" ADD VALUE 'file';

-- AlterEnum
BEGIN;
CREATE TYPE "file_purpose_new" AS ENUM ('post_image', 'product_image', 'club_image', 'general_image');
ALTER TABLE "files" ALTER COLUMN "purpose" TYPE "file_purpose_new" USING ("purpose"::text::"file_purpose_new");
ALTER TYPE "file_purpose" RENAME TO "file_purpose_old";
ALTER TYPE "file_purpose_new" RENAME TO "file_purpose";
DROP TYPE "public"."file_purpose_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "file_status_new" AS ENUM ('deleted', 'pending', 'completed');
ALTER TABLE "public"."files" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "files" ALTER COLUMN "status" TYPE "file_status_new" USING ("status"::text::"file_status_new");
ALTER TYPE "file_status" RENAME TO "file_status_old";
ALTER TYPE "file_status_new" RENAME TO "file_status";
DROP TYPE "public"."file_status_old";
ALTER TABLE "files" ALTER COLUMN "status" SET DEFAULT 'pending';
COMMIT;

-- DropForeignKey
ALTER TABLE "products" DROP CONSTRAINT "products_image_file_id_fkey";

-- AlterTable
ALTER TABLE "clubs" DROP COLUMN "image_url",
ADD COLUMN     "image_file_id" UUID;

-- CreateIndex
CREATE INDEX "clubs_image_file_id_idx" ON "clubs"("image_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_path_key" ON "files"("storage_path");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
