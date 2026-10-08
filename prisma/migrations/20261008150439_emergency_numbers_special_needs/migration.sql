-- CreateTable
CREATE TABLE "emergency_numbers" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "special_needs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mobility" TEXT NOT NULL DEFAULT 'none',
    "dietary" TEXT,
    "medical" TEXT,
    "assistance" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "special_needs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "special_needs_userId_key" ON "special_needs"("userId");

-- AddForeignKey
ALTER TABLE "special_needs" ADD CONSTRAINT "special_needs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
