-- AlterTable
ALTER TABLE "agencies" ADD COLUMN     "taxId" TEXT,
ADD COLUMN     "tradeRegister" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_bookingId_key" ON "invoices"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_agencyId_year_sequence_key" ON "invoices"("agencyId", "year", "sequence");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
