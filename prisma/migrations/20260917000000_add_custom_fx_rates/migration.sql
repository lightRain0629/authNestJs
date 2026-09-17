-- Custom FX rates.
--
-- Additive only: two nullable columns and one defaulted boolean. No DROP, no
-- TRUNCATE, no type narrowing, so it is safe against a populated database.
-- Existing rows keep their current behaviour: base_rate NULL means "use the
-- rate table", and is_custom_rate FALSE means "rate_used came from the table".

-- A record can carry the rate the user actually got, against one named base.
ALTER TABLE "finance_records"
  ADD COLUMN "base_currency" VARCHAR(10),
  ADD COLUMN "base_rate" DECIMAL(38,18);

-- A conversion records whether its rate was typed in rather than looked up.
ALTER TABLE "currency_conversions"
  ADD COLUMN "is_custom_rate" BOOLEAN NOT NULL DEFAULT false;
