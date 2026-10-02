-- Tables présentes dans schema.prisma sans migration associée : budget et
-- plan d'épargne (tickets #1, #2), checklist, micro-cours et communauté
-- (tickets #3 à #5). Généré par 'prisma migrate diff' contre une base à
-- jour des migrations précédentes : uniquement des créations.

-- CreateTable
CREATE TABLE "budget_simulations" (
    "id" TEXT NOT NULL,
    "pilgrimId" TEXT NOT NULL,
    "packageId" TEXT,
    "packagePrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pocketMoney" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gifts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sacrifice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "insurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherExpenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GNF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_simulations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "reminderDate" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_plans" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "autoDeduct" BOOLEAN NOT NULL DEFAULT false,
    "deductAmount" DOUBLE PRECISION,
    "frequency" TEXT,
    "nextDeductDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "micro_courses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "videoUrl" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "order" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT NOT NULL DEFAULT 'preparation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "micro_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "micro_course_progress" (
    "id" TEXT NOT NULL,
    "pilgrimId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "clientUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "micro_course_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_messages" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "clientSentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_simulations_pilgrimId_idx" ON "budget_simulations"("pilgrimId");

-- CreateIndex
CREATE INDEX "checklist_items_bookingId_idx" ON "checklist_items"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "savings_plans_bookingId_key" ON "savings_plans"("bookingId");

-- CreateIndex
CREATE INDEX "micro_course_progress_pilgrimId_idx" ON "micro_course_progress"("pilgrimId");

-- CreateIndex
CREATE INDEX "micro_course_progress_courseId_idx" ON "micro_course_progress"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "micro_course_progress_pilgrimId_courseId_key" ON "micro_course_progress"("pilgrimId", "courseId");

-- CreateIndex
CREATE INDEX "community_messages_groupId_idx" ON "community_messages"("groupId");

-- AddForeignKey
ALTER TABLE "budget_simulations" ADD CONSTRAINT "budget_simulations_pilgrimId_fkey" FOREIGN KEY ("pilgrimId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_simulations" ADD CONSTRAINT "budget_simulations_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_plans" ADD CONSTRAINT "savings_plans_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "micro_course_progress" ADD CONSTRAINT "micro_course_progress_pilgrimId_fkey" FOREIGN KEY ("pilgrimId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "micro_course_progress" ADD CONSTRAINT "micro_course_progress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "micro_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

