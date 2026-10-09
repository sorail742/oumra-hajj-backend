-- CreateTable
CREATE TABLE "guide_unavailabilities" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "guideId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guide_unavailabilities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "guide_unavailabilities_agencyId_idx" ON "guide_unavailabilities"("agencyId");

-- CreateIndex
CREATE INDEX "guide_unavailabilities_guideId_idx" ON "guide_unavailabilities"("guideId");

-- AddForeignKey
ALTER TABLE "guide_unavailabilities" ADD CONSTRAINT "guide_unavailabilities_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guide_unavailabilities" ADD CONSTRAINT "guide_unavailabilities_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
