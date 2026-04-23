// Long-lived worker process. Polls Postgres for queued jobs, submits
// them to MuAPI's seedance-v2.0-i2v endpoint, polls for results, applies
// retry/backoff on failure, and updates batch counters.
//
// Run inside the `worker` docker-compose service. One process per
// deployment is enough for the marketing team's volume; the claim query
// uses FOR UPDATE SKIP LOCKED so scaling to N workers is a one-line
// change later.

import { PrismaClient } from '@prisma/client';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient({ log: ['error'] });

const MUAPI_BASE = process.env.MUAPI_BASE_URL || 'https://api.muapi.ai';
const API_KEY = process.env.MUAPI_API_KEY || '';
const TICK_MS = parseInt(process.env.WORKER_TICK_MS || '2000', 10);
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

const TERMINAL_OK = new Set(['completed', 'succeeded', 'success']);
const TERMINAL_FAIL = new Set(['failed', 'error']);

let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });

log('starting', {
  base: MUAPI_BASE,
  hasApiKey: !!API_KEY,
  tickMs: TICK_MS,
  uploadDir: UPLOAD_DIR,
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
  if (!API_KEY) return; // can't do anything useful without a key

  const batches = await prisma.batch.findMany({
    where: { status: 'running' },
    orderBy: { createdAt: 'asc' },
  });

  for (const batch of batches) {
    await advanceBatch(batch);
  }

  // Polling jobs may belong to running OR paused batches (we let in-flight
  // calls finish even on pause to avoid wasting credits).
  await pollPending();
}

async function advanceBatch(batch) {
  // Count in-flight slots
  const inflight = await prisma.job.count({
    where: { batchId: batch.id, status: { in: ['submitting', 'polling'] } },
  });
  const slots = batch.concurrency - inflight;
  if (slots <= 0) return;

  // Claim queued jobs atomically with SKIP LOCKED
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
      batch: { select: { model: true } },
    },
  });
  if (!job) return;

  try {
    if (!job.trainer) throw new Error('Job has no trainer');
    const trainerCdnUrl = await ensureMuapiUrl('trainer', job.trainer);

    const payload = {
      prompt: job.prompt,
      images_list: [trainerCdnUrl],
      aspect_ratio: job.aspectRatio,
      duration: job.duration,
      quality: job.quality,
    };

    const submitRes = await fetch(`${MUAPI_BASE}/api/v1/${job.batch.model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(payload),
    });

    if (!submitRes.ok) {
      const text = await submitRes.text().catch(() => '');
      throw new Error(`MuAPI ${submitRes.status}: ${text.slice(0, 200)}`);
    }

    const data = await submitRes.json();
    const requestId = data.request_id || data.id;
    if (!requestId) throw new Error(`No request_id in response: ${JSON.stringify(data).slice(0, 200)}`);

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'polling', muapiRequestId: requestId },
    });
    log('submit.ok', { jobId: job.id, requestId });
  } catch (err) {
    log('submit.fail', { jobId: job.id, err: err.message });
    await markFailureWithBackoff(job.id, err.message);
  }
}

async function pollPending() {
  const polling = await prisma.job.findMany({
    where: { status: 'polling', muapiRequestId: { not: null } },
    take: 50,
  });
  await Promise.all(polling.map(pollJob));
}

async function pollJob(job) {
  try {
    const res = await fetch(`${MUAPI_BASE}/api/v1/predictions/${job.muapiRequestId}/result`, {
      headers: { 'x-api-key': API_KEY },
    });
    if (!res.ok) {
      // 5xx — transient, leave for next tick. 4xx — fail with backoff.
      if (res.status >= 500) return;
      const text = await res.text().catch(() => '');
      await markFailureWithBackoff(job.id, `Poll ${res.status}: ${text.slice(0, 200)}`);
      return;
    }
    const data = await res.json();
    const status = data.status?.toLowerCase();
    if (TERMINAL_OK.has(status)) {
      const videoUrl = data.outputs?.[0] || data.url || data.output?.url || data.video_url || null;
      await prisma.$transaction([
        prisma.job.update({
          where: { id: job.id },
          data: { status: 'done', videoUrl, completedAt: new Date() },
        }),
        prisma.batch.update({
          where: { id: job.batchId },
          data: { done: { increment: 1 } },
        }),
      ]);
      log('poll.done', { jobId: job.id, videoUrl });
      return;
    }
    if (TERMINAL_FAIL.has(status)) {
      await markFailureWithBackoff(job.id, data.error || `MuAPI status: ${status}`);
      return;
    }
    // pending / in_progress — leave it
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
      muapiRequestId: null,
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

// If the imageUrl is local (/api/uploads/...), upload the file to MuAPI
// and persist the resulting CDN URL so we only pay the round-trip once.
async function ensureMuapiUrl(kind, asset) {
  const url = asset.imageUrl || '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  // Local URL — re-upload from disk to MuAPI.
  const fileName = url.split('/').pop();
  if (!fileName) throw new Error(`Invalid asset url: ${url}`);
  const folder = kind === 'trainer' ? 'trainers' : 'studios';
  const filePath = path.join(UPLOAD_DIR, folder, decodeURIComponent(fileName));
  const buf = await readFile(filePath);

  const form = new FormData();
  form.append('file', new Blob([buf]), fileName);

  const res = await fetch(`${MUAPI_BASE}/api/v1/upload_file`, {
    method: 'POST',
    headers: { 'x-api-key': API_KEY },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MuAPI upload_file ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const cdnUrl = data.url || data.file_url || data?.data?.url;
  if (!cdnUrl) throw new Error('MuAPI upload returned no URL');

  // Persist back to DB so we don't re-upload for future jobs.
  if (kind === 'trainer') {
    await prisma.trainer.update({ where: { id: asset.id }, data: { imageUrl: cdnUrl } });
  } else {
    await prisma.studio.update({ where: { id: asset.id }, data: { imageUrl: cdnUrl } });
  }
  log('reupload.ok', { kind, assetId: asset.id });
  return cdnUrl;
}

async function recoverOrphans() {
  // Re-queue anything left in 'submitting' from a crashed previous run.
  const submitting = await prisma.job.updateMany({
    where: { status: 'submitting' },
    data: { status: 'queued', muapiRequestId: null },
  });
  if (submitting.count > 0) log('recover.submitting', { count: submitting.count });

  // 'polling' jobs can keep going — we have their muapiRequestId.
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
