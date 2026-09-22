-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "familyViewToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_familyViewToken_key" ON "bookings"("familyViewToken");
