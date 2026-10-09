-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "refundPolicySnapshot" JSONB;

-- CreateTable
CREATE TABLE "refund_policy_tiers" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "minDaysBeforeDeparture" INTEGER NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "refund_policy_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "refund_policy_tiers_agencyId_minDaysBeforeDeparture_key" ON "refund_policy_tiers"("agencyId", "minDaysBeforeDeparture");

-- AddForeignKey
ALTER TABLE "refund_policy_tiers" ADD CONSTRAINT "refund_policy_tiers_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
