-- Idée #63 (backlog "Cent Fonctionnalités") — astreinte 24/7.


-- CreateTable
CREATE TABLE "on_call_shifts" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "packageId" TEXT,
    "staffName" TEXT NOT NULL,
    "staffRole" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "on_call_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "on_call_shifts_agencyId_startsAt_idx" ON "on_call_shifts"("agencyId", "startsAt");

-- CreateIndex
CREATE INDEX "on_call_shifts_packageId_idx" ON "on_call_shifts"("packageId");

-- AddForeignKey
ALTER TABLE "on_call_shifts" ADD CONSTRAINT "on_call_shifts_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "on_call_shifts" ADD CONSTRAINT "on_call_shifts_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Un créneau se termine après avoir commencé, aussi garanti par le service.
ALTER TABLE "on_call_shifts" ADD CONSTRAINT "on_call_shifts_period_check" CHECK ("endsAt" > "startsAt");
