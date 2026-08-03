-- AlterEnum
ALTER TYPE "admin_action" ADD VALUE 'save_token_grants';

ALTER TABLE "token_grants"
ADD CONSTRAINT "token_grants_granted_amount_max_check"
CHECK ("granted_amount" <= 1000);
