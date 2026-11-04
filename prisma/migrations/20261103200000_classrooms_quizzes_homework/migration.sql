-- Rooms become classrooms. Each existing room's sitting (test, start time,
-- settings) moves into a Quiz in that room, keeping its attempts.

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "description" TEXT;

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "moduleMinutes" INTEGER NOT NULL DEFAULT 27,
    "calculatorAllowed" BOOLEAN NOT NULL DEFAULT true,
    "resultsReleased" BOOLEAN NOT NULL DEFAULT false,
    "testId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Homework" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "dueAt" TIMESTAMP(3) NOT NULL,
    "allowedFormats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxPoints" INTEGER NOT NULL DEFAULT 100,
    "allowLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "Homework_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HomeworkSubmission" (
    "id" TEXT NOT NULL,
    "homeworkId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "reopened" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "feedback" TEXT,
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,

    CONSTRAINT "HomeworkSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "homeworkId" TEXT,
    "submissionId" TEXT,
    "feedbackSubmissionId" TEXT,

    CONSTRAINT "StoredFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quiz_roomId_idx" ON "Quiz"("roomId");

-- CreateIndex
CREATE INDEX "Quiz_startsAt_idx" ON "Quiz"("startsAt");

-- CreateIndex
CREATE INDEX "Homework_roomId_dueAt_idx" ON "Homework"("roomId", "dueAt");

-- CreateIndex
CREATE INDEX "HomeworkSubmission_studentId_idx" ON "HomeworkSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "HomeworkSubmission_homeworkId_studentId_key" ON "HomeworkSubmission"("homeworkId", "studentId");

-- CreateIndex
CREATE INDEX "StoredFile_homeworkId_idx" ON "StoredFile"("homeworkId");

-- CreateIndex
CREATE INDEX "StoredFile_submissionId_idx" ON "StoredFile"("submissionId");

-- CreateIndex
CREATE INDEX "StoredFile_feedbackSubmissionId_idx" ON "StoredFile"("feedbackSubmissionId");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Homework" ADD CONSTRAINT "Homework_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HomeworkSubmission" ADD CONSTRAINT "HomeworkSubmission_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_homeworkId_fkey" FOREIGN KEY ("homeworkId") REFERENCES "Homework"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoredFile" ADD CONSTRAINT "StoredFile_feedbackSubmissionId_fkey" FOREIGN KEY ("feedbackSubmissionId") REFERENCES "HomeworkSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: one quiz per existing room (same id), attempts re-pointed to it.
INSERT INTO "Quiz" ("id", "roomId", "title", "startsAt", "moduleMinutes", "calculatorAllowed", "resultsReleased", "testId", "createdAt", "updatedAt", "createdById")
SELECT "id", "id", "name", "startsAt", "moduleMinutes", "calculatorAllowed", "resultsReleased", "testId", "createdAt", "updatedAt", "createdById"
FROM "Room"
WHERE "testId" IS NOT NULL OR EXISTS (SELECT 1 FROM "Attempt" a WHERE a."roomId" = "Room"."id");

ALTER TABLE "Attempt" ADD COLUMN "quizId" TEXT;
UPDATE "Attempt" SET "quizId" = "roomId";
ALTER TABLE "Attempt" ALTER COLUMN "quizId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Attempt" DROP CONSTRAINT "Attempt_roomId_fkey";
ALTER TABLE "Room" DROP CONSTRAINT "Room_testId_fkey";

-- DropIndex
DROP INDEX "Attempt_roomId_studentId_key";
DROP INDEX "Room_startsAt_idx";

-- AlterTable
ALTER TABLE "Attempt" DROP COLUMN "roomId";
ALTER TABLE "Room" DROP COLUMN "calculatorAllowed",
DROP COLUMN "moduleMinutes",
DROP COLUMN "resultsReleased",
DROP COLUMN "startsAt",
DROP COLUMN "testId";

-- CreateIndex
CREATE UNIQUE INDEX "Attempt_quizId_studentId_key" ON "Attempt"("quizId", "studentId");

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
