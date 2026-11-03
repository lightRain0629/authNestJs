-- Finance attachments: files kept alongside a record or a transfer.
--
-- Additive only: one new table, its indexes and foreign keys. No DROP, no
-- TRUNCATE, no change to any existing column, so it is safe against a
-- populated database. Existing records and conversions are untouched.
--
-- The file bytes live on disk (FINANCE_ATTACHMENTS_DIR) under storage_key, a
-- random UUID; the row only holds metadata. Deleting a record or conversion
-- cascades to its attachment rows — the application removes the files.

-- CreateTable
CREATE TABLE "finance_attachments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "record_id" TEXT,
    "conversion_id" TEXT,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_attachments_storage_key_key" ON "finance_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "finance_attachments_user_id_idx" ON "finance_attachments"("user_id");

-- CreateIndex
CREATE INDEX "finance_attachments_record_id_idx" ON "finance_attachments"("record_id");

-- CreateIndex
CREATE INDEX "finance_attachments_conversion_id_idx" ON "finance_attachments"("conversion_id");

-- AddForeignKey
ALTER TABLE "finance_attachments" ADD CONSTRAINT "finance_attachments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_attachments" ADD CONSTRAINT "finance_attachments_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "finance_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_attachments" ADD CONSTRAINT "finance_attachments_conversion_id_fkey" FOREIGN KEY ("conversion_id") REFERENCES "currency_conversions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- An attachment belongs to exactly one entry: a record or a conversion, never
-- both and never neither. Prisma cannot express this, so it lives here.
ALTER TABLE "finance_attachments" ADD CONSTRAINT "finance_attachments_one_parent"
  CHECK (("record_id" IS NULL) <> ("conversion_id" IS NULL));
