/*
  Warnings:

  - You are about to drop the column `event_end_date` on the `content_posts` table. All the data in the column will be lost.
  - You are about to drop the column `event_start_date` on the `content_posts` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `content_posts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[content_post_id,file_id]` on the table `content_images` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[content_post_id,sort_order]` on the table `content_images` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "content_post_category_type" AS ENUM ('event', 'career', 'partnership', 'co_purchase', 'announcement', 'alumni');

-- DropIndex
DROP INDEX "content_posts_show_on_calendar_event_start_date_idx";

-- DropIndex
DROP INDEX "content_posts_status_idx";

-- DropIndex
DROP INDEX "content_posts_type_idx";

-- AlterTable
ALTER TABLE "content_posts" DROP COLUMN "event_end_date",
DROP COLUMN "event_start_date",
DROP COLUMN "type",
ADD COLUMN     "event_end_at" TIMESTAMP(3),
ADD COLUMN     "event_start_at" TIMESTAMP(3),
ADD COLUMN     "members_only" BOOLEAN NOT NULL DEFAULT false;

-- DropEnum
DROP TYPE "content_post_type";

-- CreateTable
CREATE TABLE "content_post_categories" (
    "content_post_id" UUID NOT NULL,
    "category" "content_post_category_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_post_categories_pkey" PRIMARY KEY ("content_post_id","category")
);

-- CreateIndex
CREATE INDEX "content_post_categories_category_content_post_id_idx" ON "content_post_categories"("category", "content_post_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_images_content_post_id_file_id_key" ON "content_images"("content_post_id", "file_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_images_content_post_id_sort_order_key" ON "content_images"("content_post_id", "sort_order");

-- CreateIndex
CREATE INDEX "content_posts_status_deleted_at_idx" ON "content_posts"("status", "deleted_at");

-- CreateIndex
CREATE INDEX "content_posts_members_only_idx" ON "content_posts"("members_only");

-- CreateIndex
CREATE INDEX "content_posts_show_on_calendar_status_event_start_at_idx" ON "content_posts"("show_on_calendar", "status", "event_start_at");

-- AddForeignKey
ALTER TABLE "content_post_categories" ADD CONSTRAINT "content_post_categories_content_post_id_fkey" FOREIGN KEY ("content_post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
