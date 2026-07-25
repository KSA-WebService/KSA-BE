/*
  Warnings:

  - You are about to drop the column `reason` on the `admin_action_logs` table. All the data in the column will be lost.
  - You are about to drop the column `target_type` on the `admin_action_logs` table. All the data in the column will be lost.
  - Added the required column `action_type` to the `admin_action_logs` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action` on the `admin_action_logs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "admin_action_type" AS ENUM ('user', 'whitelist', 'invitation', 'content', 'product', 'order', 'token', 'memo');

-- CreateEnum
CREATE TYPE "admin_action" AS ENUM ('update_user_role', 'update_user_status', 'create_whitelist_user', 'import_whitelist_users', 'delete_whitelist_user', 'send_invitation', 'resend_invitation', 'create_content_post', 'update_content_post', 'update_content_post_status', 'delete_content_post', 'create_product', 'update_product', 'update_product_publication_status', 'delete_product', 'update_order_status', 'create_token_event', 'grant_token', 'delete_token_event', 'update_memo');

-- DropIndex
DROP INDEX "admin_action_logs_target_type_target_id_idx";

-- AlterTable
ALTER TABLE "admin_action_logs" DROP COLUMN "reason",
DROP COLUMN "target_type",
ADD COLUMN     "action_type" "admin_action_type" NOT NULL,
DROP COLUMN "action",
ADD COLUMN     "action" "admin_action" NOT NULL;

-- CreateIndex
CREATE INDEX "admin_action_logs_action_type_target_id_idx" ON "admin_action_logs"("action_type", "target_id");
