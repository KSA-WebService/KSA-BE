-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(36) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "role" VARCHAR(36) NOT NULL DEFAULT 'student',
    "status" VARCHAR(36) NOT NULL DEFAULT 'active',
    "token_balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "agreed_privacy" BOOLEAN NOT NULL DEFAULT false,
    "agreed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whitelisted_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(36) NOT NULL,
    "student_id" VARCHAR(36) NOT NULL,
    "role" VARCHAR(36) NOT NULL DEFAULT 'student',
    "status" VARCHAR(36) NOT NULL DEFAULT 'not_invited',
    "invited_by" UUID,
    "invited_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whitelisted_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(36) NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "stock_quantity" INTEGER NOT NULL,
    "image_url" TEXT,
    "is_sold_out" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" INTEGER NOT NULL,
    "status" VARCHAR(36) NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_logs" (
    "id" SERIAL NOT NULL,
    "changed_by" UUID NOT NULL,
    "order_id" INTEGER NOT NULL,
    "before_status" VARCHAR(36) NOT NULL,
    "after_status" VARCHAR(36) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_posts" (
    "id" SERIAL NOT NULL,
    "author_id" UUID NOT NULL,
    "type" VARCHAR(36) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "status" VARCHAR(36) NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_images" (
    "id" SERIAL NOT NULL,
    "post_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(36) NOT NULL,
    "category" VARCHAR(36),
    "description" TEXT,
    "instagram_url" TEXT,
    "contact_url" TEXT,
    "image_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "leader" VARCHAR(36),
    "vice_leader" VARCHAR(36),

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_action_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" UUID NOT NULL,
    "target_type" VARCHAR(36) NOT NULL,
    "target_id" INTEGER,
    "action" VARCHAR(36) NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_logs" (
    "id" SERIAL NOT NULL,
    "admin_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "before_value" INTEGER NOT NULL,
    "after_value" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_student_id_key" ON "users"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "whitelisted_users_user_id_key" ON "whitelisted_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "whitelisted_users_email_key" ON "whitelisted_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "whitelisted_users_student_id_key" ON "whitelisted_users"("student_id");

-- CreateIndex
CREATE INDEX "whitelisted_users_status_idx" ON "whitelisted_users"("status");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "orders_product_id_idx" ON "orders"("product_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_status_logs_changed_by_idx" ON "order_status_logs"("changed_by");

-- CreateIndex
CREATE INDEX "order_status_logs_order_id_idx" ON "order_status_logs"("order_id");

-- CreateIndex
CREATE INDEX "content_posts_author_id_idx" ON "content_posts"("author_id");

-- CreateIndex
CREATE INDEX "content_posts_type_idx" ON "content_posts"("type");

-- CreateIndex
CREATE INDEX "content_posts_status_idx" ON "content_posts"("status");

-- CreateIndex
CREATE INDEX "content_images_post_id_idx" ON "content_images"("post_id");

-- CreateIndex
CREATE INDEX "clubs_is_active_idx" ON "clubs"("is_active");

-- CreateIndex
CREATE INDEX "admin_action_logs_admin_id_idx" ON "admin_action_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_action_logs_target_type_target_id_idx" ON "admin_action_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "token_logs_admin_id_idx" ON "token_logs"("admin_id");

-- CreateIndex
CREATE INDEX "token_logs_user_id_idx" ON "token_logs"("user_id");

-- AddForeignKey
ALTER TABLE "whitelisted_users" ADD CONSTRAINT "whitelisted_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whitelisted_users" ADD CONSTRAINT "whitelisted_users_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_posts" ADD CONSTRAINT "content_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_images" ADD CONSTRAINT "content_images_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "content_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_logs" ADD CONSTRAINT "token_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_logs" ADD CONSTRAINT "token_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
