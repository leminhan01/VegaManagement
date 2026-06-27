-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ADMIN';
