-- =====================================================
-- Create enum types
-- =====================================================

CREATE TYPE "user_role" AS ENUM (
  'student',
  'admin'
);

CREATE TYPE "user_status" AS ENUM (
  'active',
  'blocked'
);

CREATE TYPE "whitelist_invitation_status" AS ENUM (
  'pending',
  'invited',
  'accepted',
  'expired',
  'failed'
);

CREATE TYPE "invitation_link_status" AS ENUM (
  'active',
  'accepted',
  'expired',
  'revoked',
  'failed'
);

CREATE TYPE "publication_status" AS ENUM (
  'draft',
  'published',
  'hidden'
);

CREATE TYPE "content_post_type" AS ENUM (
  'partnership',
  'event',
  'co-purchase',
  'career',
  'announcement',
  'KSA'
);

CREATE TYPE "file_status" AS ENUM (
  'deleted',
  'pending',
  'completed',
  'failed'
);

CREATE TYPE "file_purpose" AS ENUM (
  'post image',
  'product image',
  'general attachment'
);

CREATE TYPE "order_status" AS ENUM (
  'ordered',
  'accepted',
  'delivered'
);

-- =====================================================
-- Drop foreign keys affected by ID type changes
-- =====================================================

ALTER TABLE "content_images"
DROP CONSTRAINT "content_images_post_id_fkey";

ALTER TABLE "order_status_logs"
DROP CONSTRAINT "order_status_logs_order_id_fkey";

ALTER TABLE "orders"
DROP CONSTRAINT "orders_product_id_fkey";

-- =====================================================
-- Drop old indexes affected by column changes
-- =====================================================

DROP INDEX "content_images_post_id_idx";
DROP INDEX "products_is_active_idx";
DROP INDEX "users_student_id_key";
DROP INDEX "whitelisted_users_status_idx";
DROP INDEX "whitelisted_users_student_id_key";

-- =====================================================
-- Admin action logs
-- =====================================================

ALTER TABLE "admin_action_logs"
ADD COLUMN "metadata" JSONB;

ALTER TABLE "admin_action_logs"
ALTER COLUMN "target_type" DROP NOT NULL;

ALTER TABLE "admin_action_logs"
ALTER COLUMN "target_id"
SET DATA TYPE VARCHAR(128)
USING "target_id"::VARCHAR(128);

-- =====================================================
-- Clubs
-- =====================================================

ALTER TABLE "clubs"
ALTER COLUMN "name" SET DATA TYPE VARCHAR(128);

ALTER TABLE "clubs"
ALTER COLUMN "leader" SET DATA TYPE VARCHAR(128);

ALTER TABLE "clubs"
ALTER COLUMN "vice_leader" SET DATA TYPE VARCHAR(128);

-- =====================================================
-- Content images
-- Existing rows must be empty before applying
-- =====================================================

ALTER TABLE "content_images"
DROP CONSTRAINT "content_images_pkey";

ALTER TABLE "content_images"
DROP COLUMN "image_url";

ALTER TABLE "content_images"
DROP COLUMN "post_id";

ALTER TABLE "content_images"
ADD COLUMN "content_post_id" UUID NOT NULL;

ALTER TABLE "content_images"
ADD COLUMN "file_id" UUID NOT NULL;

ALTER TABLE "content_images"
DROP COLUMN "id";

ALTER TABLE "content_images"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "content_images"
ALTER COLUMN "sort_order" SET DEFAULT 1;

ALTER TABLE "content_images"
ADD CONSTRAINT "content_images_pkey" PRIMARY KEY ("id");

-- =====================================================
-- Content posts
-- Existing rows must be empty before applying
-- =====================================================

ALTER TABLE "content_posts"
DROP CONSTRAINT "content_posts_pkey";

ALTER TABLE "content_posts"
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "content_posts"
ADD COLUMN "event_end_date" DATE;

ALTER TABLE "content_posts"
ADD COLUMN "event_start_date" DATE;

ALTER TABLE "content_posts"
ADD COLUMN "show_on_calendar" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "content_posts"
DROP COLUMN "id";

ALTER TABLE "content_posts"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "content_posts"
DROP COLUMN "type";

ALTER TABLE "content_posts"
ADD COLUMN "type" "content_post_type" NOT NULL;

ALTER TABLE "content_posts"
DROP COLUMN "status";

ALTER TABLE "content_posts"
ADD COLUMN "status" "publication_status" NOT NULL DEFAULT 'draft';

ALTER TABLE "content_posts"
ADD CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id");

-- =====================================================
-- Order status logs
-- Existing rows must be empty before applying
-- =====================================================

ALTER TABLE "order_status_logs"
DROP CONSTRAINT "order_status_logs_pkey";

ALTER TABLE "order_status_logs"
DROP COLUMN "id";

ALTER TABLE "order_status_logs"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "order_status_logs"
DROP COLUMN "order_id";

ALTER TABLE "order_status_logs"
ADD COLUMN "order_id" UUID NOT NULL;

ALTER TABLE "order_status_logs"
DROP COLUMN "before_status";

ALTER TABLE "order_status_logs"
ADD COLUMN "before_status" "order_status" NOT NULL;

ALTER TABLE "order_status_logs"
DROP COLUMN "after_status";

ALTER TABLE "order_status_logs"
ADD COLUMN "after_status" "order_status" NOT NULL;

ALTER TABLE "order_status_logs"
ADD CONSTRAINT "order_status_logs_pkey" PRIMARY KEY ("id");

-- =====================================================
-- Orders
-- Existing rows must be empty before applying
-- =====================================================

ALTER TABLE "orders"
DROP CONSTRAINT "orders_pkey";

ALTER TABLE "orders"
DROP COLUMN "admin_note";

ALTER TABLE "orders"
ADD COLUMN "accepted_at" TIMESTAMP(3);

ALTER TABLE "orders"
ADD COLUMN "delivered_at" TIMESTAMP(3);

ALTER TABLE "orders"
ADD COLUMN "unit_price" INTEGER NOT NULL;

ALTER TABLE "orders"
DROP COLUMN "id";

ALTER TABLE "orders"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "orders"
DROP COLUMN "product_id";

ALTER TABLE "orders"
ADD COLUMN "product_id" UUID NOT NULL;

ALTER TABLE "orders"
DROP COLUMN "status";

ALTER TABLE "orders"
ADD COLUMN "status" "order_status" NOT NULL DEFAULT 'ordered';

UPDATE "orders"
SET "updated_at" = CURRENT_TIMESTAMP
WHERE "updated_at" IS NULL;

ALTER TABLE "orders"
ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "orders"
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");

-- =====================================================
-- Products
-- Existing rows must be empty before applying
-- =====================================================

ALTER TABLE "products"
DROP CONSTRAINT "products_pkey";

ALTER TABLE "products"
DROP COLUMN "image_url";

ALTER TABLE "products"
DROP COLUMN "is_active";

ALTER TABLE "products"
DROP COLUMN "is_sold_out";

ALTER TABLE "products"
ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "products"
ADD COLUMN "image_file_id" UUID;

ALTER TABLE "products"
ADD COLUMN "publication_status" "publication_status"
NOT NULL DEFAULT 'draft';

ALTER TABLE "products"
DROP COLUMN "id";

ALTER TABLE "products"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "products"
ALTER COLUMN "name" SET DATA TYPE VARCHAR(100);

ALTER TABLE "products"
ALTER COLUMN "stock_quantity" SET DEFAULT 0;

UPDATE "products"
SET "updated_at" = CURRENT_TIMESTAMP
WHERE "updated_at" IS NULL;

ALTER TABLE "products"
ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "products"
ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "products"
ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");

-- =====================================================
-- Token logs
-- Existing rows must be empty before applying
-- =====================================================

ALTER TABLE "token_logs"
DROP CONSTRAINT "token_logs_pkey";

ALTER TABLE "token_logs"
ADD COLUMN "token_event_id" UUID NOT NULL;

ALTER TABLE "token_logs"
DROP COLUMN "id";

ALTER TABLE "token_logs"
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_pkey" PRIMARY KEY ("id");

-- =====================================================
-- Users
-- Preserve existing student number, role and status
-- =====================================================

ALTER TABLE "users"
RENAME COLUMN "student_id" TO "student_number";

ALTER TABLE "users"
ALTER COLUMN "name" SET DATA TYPE VARCHAR(128);

ALTER TABLE "users"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users"
ALTER COLUMN "role"
SET DATA TYPE "user_role"
USING (
  CASE
    WHEN "role" = 'admin'
      THEN 'admin'::"user_role"
    ELSE 'student'::"user_role"
  END
);

ALTER TABLE "users"
ALTER COLUMN "role" SET DEFAULT 'student';

ALTER TABLE "users"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "users"
ALTER COLUMN "status"
SET DATA TYPE "user_status"
USING (
  CASE
    WHEN "status" = 'blocked'
      THEN 'blocked'::"user_status"
    ELSE 'active'::"user_status"
  END
);

ALTER TABLE "users"
ALTER COLUMN "status" SET DEFAULT 'active';

-- =====================================================
-- Whitelisted users
-- Preserve student number and convert old status
-- =====================================================

ALTER TABLE "whitelisted_users"
RENAME COLUMN "student_id" TO "student_number";

ALTER TABLE "whitelisted_users"
ADD COLUMN "invitation_status" "whitelist_invitation_status"
NOT NULL DEFAULT 'pending';

UPDATE "whitelisted_users"
SET "invitation_status" =
  CASE
    WHEN "status" = 'invited'
      THEN 'invited'::"whitelist_invitation_status"
    WHEN "status" = 'accepted'
      THEN 'accepted'::"whitelist_invitation_status"
    WHEN "status" = 'expired'
      THEN 'expired'::"whitelist_invitation_status"
    WHEN "status" = 'failed'
      THEN 'failed'::"whitelist_invitation_status"
    ELSE 'pending'::"whitelist_invitation_status"
  END;

ALTER TABLE "whitelisted_users"
DROP COLUMN "role";

ALTER TABLE "whitelisted_users"
DROP COLUMN "status";

-- =====================================================
-- Invitations
-- =====================================================

CREATE TABLE "invitations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "whitelist_user_id" UUID NOT NULL,
  "sent_by" UUID,
  "token_hash" VARCHAR(255) NOT NULL,
  "link_status" "invitation_link_status" NOT NULL DEFAULT 'active',
  "sent_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- Files
-- =====================================================

CREATE TABLE "files" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "uploaded_by" UUID,
  "original_name" VARCHAR(255) NOT NULL,
  "storage_path" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "content_type" VARCHAR(128) NOT NULL,
  "file_size" INTEGER NOT NULL,
  "purpose" "file_purpose" NOT NULL,
  "status" "file_status" NOT NULL DEFAULT 'pending',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- Admin memos
-- =====================================================

CREATE TABLE "admin_memos" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "updated_by" UUID,
  "content" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_memos_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- Token events
-- =====================================================

CREATE TABLE "token_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "created_by" UUID NOT NULL,
  "event_name" VARCHAR(128) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),

  CONSTRAINT "token_events_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- Indexes
-- =====================================================

CREATE UNIQUE INDEX "invitations_token_hash_key"
ON "invitations"("token_hash");

CREATE INDEX "invitations_whitelist_user_id_idx"
ON "invitations"("whitelist_user_id");

CREATE INDEX "invitations_sent_by_idx"
ON "invitations"("sent_by");

CREATE INDEX "invitations_link_status_idx"
ON "invitations"("link_status");

CREATE INDEX "invitations_expires_at_idx"
ON "invitations"("expires_at");

CREATE INDEX "files_uploaded_by_idx"
ON "files"("uploaded_by");

CREATE INDEX "files_status_idx"
ON "files"("status");

CREATE INDEX "files_purpose_idx"
ON "files"("purpose");

CREATE INDEX "admin_memos_updated_by_idx"
ON "admin_memos"("updated_by");

CREATE INDEX "token_events_created_by_idx"
ON "token_events"("created_by");

CREATE INDEX "content_images_content_post_id_idx"
ON "content_images"("content_post_id");

CREATE INDEX "content_images_file_id_idx"
ON "content_images"("file_id");

CREATE INDEX "content_posts_type_idx"
ON "content_posts"("type");

CREATE INDEX "content_posts_status_idx"
ON "content_posts"("status");

CREATE INDEX "content_posts_show_on_calendar_event_start_date_idx"
ON "content_posts"("show_on_calendar", "event_start_date");

CREATE INDEX "order_status_logs_order_id_idx"
ON "order_status_logs"("order_id");

CREATE INDEX "orders_product_id_idx"
ON "orders"("product_id");

CREATE INDEX "orders_status_idx"
ON "orders"("status");

CREATE INDEX "products_image_file_id_idx"
ON "products"("image_file_id");

CREATE INDEX "products_publication_status_idx"
ON "products"("publication_status");

CREATE INDEX "token_logs_token_event_id_idx"
ON "token_logs"("token_event_id");

CREATE UNIQUE INDEX "users_student_number_key"
ON "users"("student_number");

CREATE UNIQUE INDEX "whitelisted_users_student_number_key"
ON "whitelisted_users"("student_number");

CREATE INDEX "whitelisted_users_invitation_status_idx"
ON "whitelisted_users"("invitation_status");

CREATE INDEX "whitelisted_users_invited_by_idx"
ON "whitelisted_users"("invited_by");

-- =====================================================
-- Foreign keys
-- =====================================================

ALTER TABLE "invitations"
ADD CONSTRAINT "invitations_whitelist_user_id_fkey"
FOREIGN KEY ("whitelist_user_id")
REFERENCES "whitelisted_users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "invitations"
ADD CONSTRAINT "invitations_sent_by_fkey"
FOREIGN KEY ("sent_by")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "files"
ADD CONSTRAINT "files_uploaded_by_fkey"
FOREIGN KEY ("uploaded_by")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "products"
ADD CONSTRAINT "products_image_file_id_fkey"
FOREIGN KEY ("image_file_id")
REFERENCES "files"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_product_id_fkey"
FOREIGN KEY ("product_id")
REFERENCES "products"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "order_status_logs"
ADD CONSTRAINT "order_status_logs_order_id_fkey"
FOREIGN KEY ("order_id")
REFERENCES "orders"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "content_images"
ADD CONSTRAINT "content_images_content_post_id_fkey"
FOREIGN KEY ("content_post_id")
REFERENCES "content_posts"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "content_images"
ADD CONSTRAINT "content_images_file_id_fkey"
FOREIGN KEY ("file_id")
REFERENCES "files"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "admin_memos"
ADD CONSTRAINT "admin_memos_updated_by_fkey"
FOREIGN KEY ("updated_by")
REFERENCES "users"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "token_events"
ADD CONSTRAINT "token_events_created_by_fkey"
FOREIGN KEY ("created_by")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "token_logs"
ADD CONSTRAINT "token_logs_token_event_id_fkey"
FOREIGN KEY ("token_event_id")
REFERENCES "token_events"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;