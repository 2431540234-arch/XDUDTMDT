/*
  Warnings:

  - You are about to alter the column `file_size` on the `media` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "media" ALTER COLUMN "file_size" SET DATA TYPE INTEGER;
