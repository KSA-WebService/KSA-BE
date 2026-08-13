-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_whitelist_user_id_fkey";

-- AlterTable
ALTER TABLE "whitelisted_users" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "name" SET DATA TYPE VARCHAR(128);

-- CreateIndex
CREATE INDEX "whitelisted_users_deleted_at_idx" ON "whitelisted_users"("deleted_at");

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_whitelist_user_id_fkey" FOREIGN KEY ("whitelist_user_id") REFERENCES "whitelisted_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
