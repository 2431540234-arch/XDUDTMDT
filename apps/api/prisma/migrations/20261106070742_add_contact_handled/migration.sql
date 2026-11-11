-- AlterTable
ALTER TABLE "contact_messages" ADD COLUMN     "handled_at" TIMESTAMPTZ(6),
ADD COLUMN     "handled_by" INTEGER;
