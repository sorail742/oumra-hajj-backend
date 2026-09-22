-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'refunded';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refundedAmount" DOUBLE PRECISION,
ADD COLUMN     "refundedAt" TIMESTAMP(3);
