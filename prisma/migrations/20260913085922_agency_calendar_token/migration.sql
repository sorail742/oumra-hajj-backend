-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "agencies_calendarToken_key" ON "agencies"("calendarToken");
