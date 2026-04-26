// Segmind adapter — Seedance 2.0 i2v.
//
// Two-step flow per job:
//   1. POST workflows-api.segmind.com/upload-asset (JSON body, base64 data URL)
//      → returns { urls: [...] }, we use urls[0] as first_frame_url
//   2. POST api.segmind.com/v1/seedance-2.0
//      → returns binary MP4 synchronously (avg ~2 min wait)
//
// Because the response body IS the video, this adapter writes the MP4 to
// /data/uploads/videos/<jobId>.mp4 and returns a /api/uploads/videos/...
// URL. The polling step is skipped — submit returns videoUrl directly.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const STORAGE_BASE = 'https://workflows-api.segmind.com';
const MODEL_BASE = 'https://api.segmind.com/v1';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

export const id = 'segmind';
export const label = 'Segmind';
export const defaultModel = 'seedance-2.0';

export async function submit({ apiKey, prompt, imageBuffer, imageMime, jobId, duration, aspectRatio, resolution, model }) {
  // Step 1: upload the trainer image to Segmind storage.
  const dataUrl = `data:${imageMime || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;
  const uploadRes = await fetch(`${STORAGE_BASE}/upload-asset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ data_urls: [dataUrl] }),
  });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => '');
    throw new Error(`Segmind upload-asset ${uploadRes.status}: ${text.slice(0, 200)}`);
  }
  const uploadJson = await uploadRes.json();
  const firstFrameUrl = uploadJson.urls?.[0];
  if (!firstFrameUrl) {
    throw new Error(`Segmind upload-asset returned no url: ${JSON.stringify(uploadJson).slice(0, 200)}`);
  }

  // Step 2: submit the i2v request. Segmind returns binary MP4 synchronously.
  const payload = {
    first_frame_url: firstFrameUrl,
    prompt,
    duration,
    aspect_ratio: aspectRatio,
    resolution: resolution || '480p',
  };
  const genRes = await fetch(`${MODEL_BASE}/${model || defaultModel}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  if (!genRes.ok) {
    const text = await genRes.text().catch(() => '');
    throw new Error(`Segmind ${model || defaultModel} ${genRes.status}: ${text.slice(0, 200)}`);
  }

  // Response IS the video — read the buffer and persist locally.
  const contentType = genRes.headers.get('content-type') || '';
  if (!contentType.startsWith('video/')) {
    // Sometimes Segmind returns JSON on policy violations even with 2xx.
    const text = await genRes.text().catch(() => '');
    throw new Error(`Segmind returned non-video content-type "${contentType}": ${text.slice(0, 300)}`);
  }
  const videoBuf = Buffer.from(await genRes.arrayBuffer());

  const ext = contentType.includes('webm') ? '.webm' : '.mp4';
  const fileName = `${jobId}${ext}`;
  const dir = path.join(UPLOAD_DIR, 'videos');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), videoBuf);

  return {
    videoUrl: `/api/uploads/videos/${encodeURIComponent(fileName)}`,
  };
}

// Polling never used — submit is synchronous. Kept for interface parity.
export async function pollResult() {
  return { status: 'failed', error: 'Segmind responses are sync; pollResult should not be called' };
}

// Used by the trainer/studio create routes (one-off, not per-job). Same
// upload-asset endpoint.
export async function uploadAsset({ apiKey, file, fileName }) {
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || mimeFromName(fileName) || 'image/jpeg';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  const res = await fetch(`${STORAGE_BASE}/upload-asset`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ data_urls: [dataUrl] }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Segmind upload-asset ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const url = data.urls?.[0];
  if (!url) throw new Error(`Segmind upload-asset returned no URL: ${JSON.stringify(data).slice(0, 200)}`);
  return { url };
}

function mimeFromName(name) {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return null;
}
