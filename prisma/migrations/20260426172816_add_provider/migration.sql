-- Add provider column. Backfill existing rows to 'muapi' (the only provider
-- in production at this migration), then drop the default so new batches
-- must explicitly specify a provider at the application layer.
ALTER TABLE "batches" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'muapi';
ALTER TABLE "batches" ALTER COLUMN "provider" DROP DEFAULT;

-- Rename muapi_request_id to provider_request_id (preserves in-flight values
-- — Prisma's draft would have done DROP+ADD, losing data).
ALTER TABLE "jobs" RENAME COLUMN "muapi_request_id" TO "provider_request_id";
