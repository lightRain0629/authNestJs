-- CreateEnum
CREATE TYPE "FinanceArticleKind" AS ENUM ('EXPENSE', 'INCOME');

-- CreateEnum
CREATE TYPE "FinanceRecordType" AS ENUM ('EXPENSE', 'INCOME');

-- CreateTable
CREATE TABLE "finance_articles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "FinanceArticleKind" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "FinanceRecordType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "article_id" TEXT,
    "remark" TEXT,
    "operation_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_rates" (
    "id" TEXT NOT NULL,
    "base_currency" VARCHAR(3) NOT NULL,
    "quote_currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_conversions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_amount" DECIMAL(18,4) NOT NULL,
    "from_currency" VARCHAR(3) NOT NULL,
    "to_amount" DECIMAL(18,4) NOT NULL,
    "to_currency" VARCHAR(3) NOT NULL,
    "rate_used" DECIMAL(18,8) NOT NULL,
    "rate_id" TEXT,
    "fee_amount" DECIMAL(18,4),
    "fee_currency" VARCHAR(3),
    "remark" TEXT,
    "operation_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currency_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_articles_user_id_kind_idx" ON "finance_articles"("user_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "finance_articles_user_kind_name_unique" ON "finance_articles"("user_id", "kind", "name");

-- CreateIndex
CREATE INDEX "finance_records_user_id_operation_date_idx" ON "finance_records"("user_id", "operation_date");

-- CreateIndex
CREATE INDEX "finance_records_user_id_type_idx" ON "finance_records"("user_id", "type");

-- CreateIndex
CREATE INDEX "finance_records_article_id_idx" ON "finance_records"("article_id");

-- CreateIndex
CREATE INDEX "currency_rates_base_currency_quote_currency_effective_at_idx" ON "currency_rates"("base_currency", "quote_currency", "effective_at");

-- CreateIndex
CREATE INDEX "currency_conversions_user_id_operation_date_idx" ON "currency_conversions"("user_id", "operation_date");

-- CreateIndex
CREATE INDEX "currency_conversions_from_currency_to_currency_idx" ON "currency_conversions"("from_currency", "to_currency");

-- AddForeignKey
ALTER TABLE "finance_articles" ADD CONSTRAINT "finance_articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_records" ADD CONSTRAINT "finance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_records" ADD CONSTRAINT "finance_records_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "finance_articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_conversions" ADD CONSTRAINT "currency_conversions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_conversions" ADD CONSTRAINT "currency_conversions_rate_id_fkey" FOREIGN KEY ("rate_id") REFERENCES "currency_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
