-- CreateTable
CREATE TABLE "trainers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "csv_label" TEXT,
    "image_url" TEXT NOT NULL,
    "local_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trainers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studios" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "csv_label" TEXT,
    "image_url" TEXT NOT NULL,
    "local_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "studios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'seedance-v2.0-i2v',
    "duration" INTEGER NOT NULL DEFAULT 15,
    "quality" TEXT NOT NULL DEFAULT 'basic',
    "aspect_ratio" TEXT NOT NULL DEFAULT '16:9',
    "concurrency" INTEGER NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "row_index" INTEGER NOT NULL,
    "practice_name" TEXT NOT NULL,
    "trainer_id" TEXT,
    "studio_id" TEXT,
    "prompt" TEXT NOT NULL,
    "start_position" TEXT,
    "camera_angle" TEXT,
    "aspect_ratio" TEXT NOT NULL DEFAULT '16:9',
    "duration" INTEGER NOT NULL DEFAULT 15,
    "quality" TEXT NOT NULL DEFAULT 'basic',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "retries" INTEGER NOT NULL DEFAULT 0,
    "muapi_request_id" TEXT,
    "video_url" TEXT,
    "error" TEXT,
    "next_attempt_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainers_csv_label_key" ON "trainers"("csv_label");

-- CreateIndex
CREATE UNIQUE INDEX "studios_csv_label_key" ON "studios"("csv_label");

-- CreateIndex
CREATE INDEX "jobs_batch_id_status_idx" ON "jobs"("batch_id", "status");

-- CreateIndex
CREATE INDEX "jobs_status_next_attempt_at_idx" ON "jobs"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_studio_id_fkey" FOREIGN KEY ("studio_id") REFERENCES "studios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
