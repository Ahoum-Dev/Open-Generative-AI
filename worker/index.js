// Long-lived worker process. Polls Postgres for queued jobs, dispatches
// them to the configured provider adapter (MuAPI / Segmind / BytePlus /
// OpenRouter), polls for results, applies retry/backoff on failure, and
// updates batch counters.
//
// Run inside the `worker` docker-compose service. One process per
// deployment is enough for typical batch volumes; the claim query
// uses FOR UPDATE SKIP LOCKED so scaling to N workers is a one-line
// change later.

import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { renderPrompt } from '../lib/promptTemplate.js';
import { getProvider } from '../lib/providers/index.js';

const prisma = new PrismaClient({ log: ['error'] });

const TICK_MS = parseInt(process.env.WORKER_TICK_MS || '2000', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

// Per-provider API keys read from env. Missing keys mean batches for that
// provider are skipped with a clear error in markFailureWithBackoff.
const API_KEYS = {
  muapi: process.env.MUAPI_API_KEY || '',
  segmind: process.env.SEGMIND_API_KEY || '',
  byteplus: process.env.BYTEPLUS_API_KEY || '',
  openrouter: process.env.OPENROUTER_API_KEY || '',
};

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

log('starting', {
  tickMs: TICK_MS,
  uploadDir: UPLOAD_DIR,
  providersWithKeys: Object.entries(API_KEYS).filter(([, v]) => !!v).map(([k]) => k),
});

await recoverOrphans();

while (!stopping) {
  try {
    await tick();
  } catch (err) {
    log('tick.error', { err: err.message });
  }
  await sleep(TICK_MS);
}

log('stopping');
await prisma.$disconnect();

// ────────────────────────────────────────────────────────────────────────────
async function tick() {
  const batches = await prisma.batch.findMany({
    where: { status: 'running' },
    orderBy: { createdAt: 'asc' },
  });

  for (const batch of batches) {
    if (!API_KEYS[batch.provider]) continue; // skip until key is configured
    await advanceBatch(batch);
  }

  // Polling jobs may belong to running OR paused batches.
  await pollPending();
}

async function advanceBatch(batch) {
  const inflight = await prisma.job.count({
    where: { batchId: batch.id, status: { in: ['submitting', 'polling'] } },
  });
  const slots = batch.concurrency - inflight;
  if (slots <= 0) return;

  const ids = await claimJobs(batch.id, slots);
  if (ids.length === 0) {
    await maybeMarkCompleted(batch);
    return;
  }

  await Promise.all(ids.map(submitJob));
}

async function claimJobs(batchId, slots) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id FROM jobs
      WHERE batch_id = ${batchId}
        AND status = 'queued'
        AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
      ORDER BY row_index ASC
      LIMIT ${slots}
      FOR UPDATE SKIP LOCKED
    `;
    const ids = rows.map((r) => r.id);
    if (ids.length === 0) return [];
    await tx.job.updateMany({
      where: { id: { in: ids } },
      data: { status: 'submitting', startedAt: new Date(), error: null },
    });
    return ids;
  });
}

async function submitJob(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      trainer: true,
      studio: true,
      batch: { select: { provider: true, model: true } },
    },
  });
  if (!job) return;

  const provider = getProvider(job.batch.provider);
  const apiKey = API_KEYS[provider.id];

  try {
    if (!job.trainer) throw new Error('Job has no trainer');
    const { buffer: imageBuffer, mime: imageMime, fileName: imageFileName } = await loadAssetBuffer(job.trainer);

    const prompt = renderPrompt({
      trainer: job.trainer,
      studio: job.studio,
      job,
    });

    const result = await provider.submit({
      apiKey,
      prompt,
      imageBuffer,
      imageMime,
      imageFileName,
      jobId: job.id,
      duration: job.duration,
      quality: job.quality,
      resolution: '480p',
      aspectRatio: job.aspectRatio,
      model: job.batch.model,
    });

    // Some providers (e.g. Segmind sync mode) return a videoUrl immediately.
    // Skip the polling step in that case.
    if (result.videoUrl) {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: {
            status: 'done',
            videoUrl: result.videoUrl,
            providerRequestId: result.providerRequestId || null,
            completedAt: new Date(),
          },
        }),
        prisma.batch.update({
          where: { id: job.batchId },
          data: { done: { increment: 1 } },
        }),
      ]);
      log('submit.sync_done', { jobId: job.id, videoUrl: result.videoUrl });
      return;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'polling', providerRequestId: result.providerRequestId },
    });
    log('submit.ok', { jobId: job.id, providerRequestId: result.providerRequestId, provider: provider.id });
  } catch (err) {
    log('submit.fail', { jobId: job.id, err: err.message });
    await markFailureWithBackoff(job.id, err.message);
  }
}

async function pollPending() {
  const polling = await prisma.job.findMany({
    where: { status: 'polling', providerRequestId: { not: null } },
    include: { batch: { select: { provider: true } } },
    take: 50,
  });
  await Promise.all(polling.map(pollJob));
}

async function pollJob(job) {
  const provider = getProvider(job.batch.provider);
  const apiKey = API_KEYS[provider.id];
  if (!apiKey) return;

  try {
    const result = await provider.pollResult({
      apiKey,
      providerRequestId: job.providerRequestId,
    });

    if (result.status === 'done') {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'done', videoUrl: result.videoUrl, completedAt: new Date() },
        }),
        prisma.batch.update({
          where: { id: job.batchId },
          data: { done: { increment: 1 } },
        }),
      ]);
      log('poll.done', { jobId: job.id, videoUrl: result.videoUrl });
      return;
    }
    if (result.status === 'failed') {
      await markFailureWithBackoff(job.id, result.error || 'unknown failure');
      return;
    }
    // pending — leave it
  } catch (err) {
    log('poll.error', { jobId: job.id, err: err.message });
  }
}

async function markFailureWithBackoff(jobId, errorMsg) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;

  const nextRetries = job.retries + 1;
  if (nextRetries > 3) {
    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          retries: nextRetries,
          error: errorMsg.slice(0, 1000),
          completedAt: new Date(),
        },
      }),
      prisma.batch.update({
        where: { id: job.batchId },
        data: { failed: { increment: 1 } },
      }),
    ]);
    log('job.failed', { jobId, retries: nextRetries });
    return;
  }

  const backoffMs = Math.min(10 * Math.pow(3, job.retries), 300) * 1000;
  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: 'queued',
      retries: nextRetries,
      error: errorMsg.slice(0, 1000),
      nextAttemptAt: new Date(Date.now() + backoffMs),
      providerRequestId: null,
    },
  });
  log('job.retry', { jobId, retries: nextRetries, backoffMs });
}

async function maybeMarkCompleted(batch) {
  const counts = await prisma.job.groupBy({
    by: ['status'],
    where: { batchId: batch.id },
    _count: { _all: true },
  });
  const map = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
  const finished = (map.done || 0) + (map.failed || 0) + (map.cancelled || 0);
  if (finished >= batch.total) {
    await prisma.batch.update({
      where: { id: batch.id },
      data: { status: 'completed' },
    });
    log('batch.completed', { batchId: batch.id });
  }
}

// Read the local file backing an asset (trainer/studio) into a Buffer so the
// active provider's adapter can upload it however it likes. We don't cache a
// per-trainer CDN URL anymore because trainers can be reused across providers,
// and a cached URL from one provider isn't reachable by another.
async function loadAssetBuffer(asset) {
  // Prefer localPath (set on upload); fall back to deriving from imageUrl
  // for legacy rows that only stored a remote URL.
  let filePath = asset.localPath;
  if (!filePath) {
    const url = asset.imageUrl || '';
    if (!url.startsWith('/api/uploads/')) {
      throw new Error(`Asset ${asset.id} has no localPath and imageUrl is not local`);
    }
    const fileName = decodeURIComponent(url.split('/').pop() || '');
    filePath = path.join(UPLOAD_DIR, 'trainers', fileName);
  }
  const buffer = await readFile(filePath);
  const fileName = path.basename(filePath);
  return { buffer, mime: mimeFromName(fileName), fileName };
}

function mimeFromName(name) {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

async function recoverOrphans() {
  const submitting = await prisma.job.updateMany({
    where: { status: 'submitting' },
    data: { status: 'queued', providerRequestId: null },
  });
  if (submitting.count > 0) log('recover.submitting', { count: submitting.count });

  const stillPolling = await prisma.job.count({ where: { status: 'polling' } });
  if (stillPolling > 0) log('recover.polling', { count: stillPolling });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function log(event, fields = {}) {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${event} ${JSON.stringify(fields)}\n`);
}
