/*
  Warnings:

  - Added the required column `user_id` to the `currency_rates` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."currency_rates_base_currency_quote_currency_effective_at_idx";

-- AlterTable
ALTER TABLE "currency_rates" ADD COLUMN     "user_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "currency_rates_user_id_base_currency_quote_currency_effecti_idx" ON "currency_rates"("user_id", "base_currency", "quote_currency", "effective_at");

-- AddForeignKey
ALTER TABLE "currency_rates" ADD CONSTRAINT "currency_rates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
