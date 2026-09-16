-- CreateEnum
CREATE TYPE "FinancePlanKind" AS ENUM ('LIMIT', 'GOAL', 'SAVING');

-- CreateEnum
CREATE TYPE "FinancePlanPeriod" AS ENUM ('MONTH', 'QUARTER', 'YEAR', 'CUSTOM');

-- CreateTable
CREATE TABLE "finance_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "FinancePlanKind" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(28,8) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "period" "FinancePlanPeriod" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "article_id" TEXT,
    "account_id" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_plans_user_id_kind_idx" ON "finance_plans"("user_id", "kind");

-- CreateIndex
CREATE INDEX "finance_plans_user_id_is_archived_idx" ON "finance_plans"("user_id", "is_archived");

-- AddForeignKey
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "finance_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
