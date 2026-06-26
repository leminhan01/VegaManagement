-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT false;
