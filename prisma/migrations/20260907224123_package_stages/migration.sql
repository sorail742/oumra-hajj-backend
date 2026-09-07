-- AlterTable
ALTER TABLE "packages" DROP COLUMN "hotelName",
DROP COLUMN "hotelCity",
DROP COLUMN "hotelDistanceToMosqueM";

-- CreateTable
CREATE TABLE "package_stages" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "hotelName" TEXT NOT NULL,
    "distanceToMosqueMeters" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_stages_packageId_idx" ON "package_stages"("packageId");

-- AddForeignKey
ALTER TABLE "package_stages" ADD CONSTRAINT "package_stages_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
