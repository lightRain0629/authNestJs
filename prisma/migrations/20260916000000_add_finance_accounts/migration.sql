-- CreateEnum
CREATE TYPE "FinanceAccountKind" AS ENUM ('CASH', 'BANK', 'CARD', 'EWALLET', 'CRYPTO', 'SAVINGS', 'INVESTMENT', 'PROPERTY', 'RECEIVABLE', 'LOAN', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceAccountValuationMode" AS ENUM ('TRACKED', 'VALUED');

-- AlterTable
ALTER TABLE "finance_records" ADD COLUMN     "account_id" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(28,8),
ALTER COLUMN "currency" SET DATA TYPE VARCHAR(10);

-- AlterTable
ALTER TABLE "currency_rates" ALTER COLUMN "base_currency" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "quote_currency" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "rate" SET DATA TYPE DECIMAL(38,18);

-- AlterTable
ALTER TABLE "currency_conversions" ADD COLUMN     "from_account_id" TEXT,
ADD COLUMN     "to_account_id" TEXT,
ALTER COLUMN "from_amount" SET DATA TYPE DECIMAL(28,8),
ALTER COLUMN "from_currency" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "to_amount" SET DATA TYPE DECIMAL(28,8),
ALTER COLUMN "to_currency" SET DATA TYPE VARCHAR(10),
ALTER COLUMN "rate_used" SET DATA TYPE DECIMAL(38,18),
ALTER COLUMN "fee_amount" SET DATA TYPE DECIMAL(28,8),
ALTER COLUMN "fee_currency" SET DATA TYPE VARCHAR(10);

-- CreateTable
CREATE TABLE "finance_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "FinanceAccountKind" NOT NULL,
    "valuationMode" "FinanceAccountValuationMode" NOT NULL DEFAULT 'TRACKED',
    "currency" VARCHAR(10) NOT NULL,
    "opening_balance" DECIMAL(28,8) NOT NULL DEFAULT 0,
    "opening_date" TIMESTAMP(3) NOT NULL,
    "institution" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "counterparty" TEXT,
    "credit_limit" DECIMAL(28,8),
    "interest_rate" DECIMAL(9,4),
    "due_date" TIMESTAMP(3),
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "exclude_from_net_worth" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_account_valuations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "value" DECIMAL(28,8) NOT NULL,
    "remark" TEXT,
    "valued_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_account_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_accounts_user_id_kind_idx" ON "finance_accounts"("user_id", "kind");

-- CreateIndex
CREATE INDEX "finance_accounts_user_id_is_archived_idx" ON "finance_accounts"("user_id", "is_archived");

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_user_name_unique" ON "finance_accounts"("user_id", "name");

-- CreateIndex
CREATE INDEX "finance_account_valuations_account_id_valued_at_idx" ON "finance_account_valuations"("account_id", "valued_at");

-- CreateIndex
CREATE INDEX "finance_account_valuations_user_id_valued_at_idx" ON "finance_account_valuations"("user_id", "valued_at");

-- CreateIndex
CREATE INDEX "finance_records_account_id_operation_date_idx" ON "finance_records"("account_id", "operation_date");

-- CreateIndex
CREATE INDEX "currency_conversions_from_account_id_operation_date_idx" ON "currency_conversions"("from_account_id", "operation_date");

-- CreateIndex
CREATE INDEX "currency_conversions_to_account_id_operation_date_idx" ON "currency_conversions"("to_account_id", "operation_date");

-- AddForeignKey
ALTER TABLE "finance_records" ADD CONSTRAINT "finance_records_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_conversions" ADD CONSTRAINT "currency_conversions_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_conversions" ADD CONSTRAINT "currency_conversions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_accounts" ADD CONSTRAINT "finance_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_account_valuations" ADD CONSTRAINT "finance_account_valuations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_account_valuations" ADD CONSTRAINT "finance_account_valuations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

