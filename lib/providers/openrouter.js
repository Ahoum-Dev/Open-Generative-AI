// OpenRouter adapter — Seedance 2.0 i2v.
//
// Pattern (per openrouter.ai/docs/guides/overview/multimodal/video-generation):
//   POST https://openrouter.ai/api/v1/videos
//     body: { model, prompt, frame_images, resolution, aspect_ratio, duration }
//     auth: Authorization: Bearer <OPENROUTER_API_KEY>
//   → 202 { id, polling_url, status: "pending" }
//
//   GET https://openrouter.ai/api/v1/videos/{id}
//   → { status, unsigned_urls: [...] } when completed
//
// unsigned_urls require the same Bearer token to download. We stream the
// completed video to /data/uploads/videos/<jobId>.mp4 and return that
// local path so the BatchDetail player can play it without exposing the
// API key to the browser.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { TerminalProviderError } from './errors.js';

const BASE = 'https://openrouter.ai/api/v1';
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/data/uploads';

export const id = 'openrouter';
export const label = 'OpenRouter';
export const defaultModel = 'bytedance/seedance-2.0';

const TERMINAL_OK = new Set(['completed', 'succeeded', 'success']);
const TERMINAL_FAIL = new Set(['failed', 'error', 'cancelled', 'canceled']);

export async function submit({ apiKey, prompt, imageBuffer, imageMime, jobId, duration, aspectRatio, resolution, model }) {
  const dataUrl = `data:${imageMime || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;

  const payload = {
    model: model || defaultModel,
    prompt,
    frame_images: [
      {
        type: 'image_url',
        image_url: { url: dataUrl },
        frame_type: 'first_frame',
      },
    ],
    resolution: resolution || '480p',
    aspect_ratio: aspectRatio,
    duration,
  };

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
  // OpenRouter is OpenAI-compatible and dedupes requests with the same key.
  // If a retry hits an already-processed job, the same response comes back
  // instead of a second billable generation.
  if (jobId) headers['Idempotency-Key'] = jobId;

  const res = await fetch(`${BASE}/videos`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = `OpenRouter ${res.status}: ${text.slice(0, 300)}`;
    if (res.status >= 400 && res.status < 500) {
      throw new TerminalProviderError(msg, { billed: false });
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const providerRequestId = data.id;
  if (!providerRequestId) {
    throw new TerminalProviderError(
      `OpenRouter: no id in response: ${JSON.stringify(data).slice(0, 200)}`,
      { billed: null },
    );
  }
  return { providerRequestId };
}

export async function pollResult({ apiKey, providerRequestId }) {
  const res = await fetch(`${BASE}/videos/${providerRequestId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status >= 500) return { status: 'pending' };
    const text = await res.text().catch(() => '');
    throw new TerminalProviderError(
      `OpenRouter poll ${res.status}: ${text.slice(0, 200)}`,
      { billed: null },
    );
  }
  const data = await res.json();
  const s = (data.status || '').toLowerCase();
  if (TERMINAL_OK.has(s)) {
    const sourceUrl = data.unsigned_urls?.[0];
    if (!sourceUrl) {
      throw new TerminalProviderError(
        `OpenRouter completed but no unsigned_urls: ${JSON.stringify(data).slice(0, 300)}`,
        { billed: true },
      );
    }
    const localUrl = await streamToLocal(apiKey, sourceUrl, providerRequestId);
    return { status: 'done', videoUrl: localUrl };
  }
  if (TERMINAL_FAIL.has(s)) {
    throw new TerminalProviderError(
      data.error?.message || data.message || `OpenRouter status: ${s}`,
      { billed: s === 'failed' || s === 'error' },
    );
  }
  return { status: 'pending' };
}

async function streamToLocal(apiKey, sourceUrl, jobId) {
  const res = await fetch(sourceUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    throw new Error(`OpenRouter content fetch ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get('content-type') || '';
  const ext = ct.includes('webm') ? '.webm' : '.mp4';
  const fileName = `${jobId}${ext}`;
  const dir = path.join(UPLOAD_DIR, 'videos');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buf);
  return `/api/uploads/videos/${encodeURIComponent(fileName)}`;
}

// OpenRouter has no separate asset upload endpoint — images are sent inline
// per request. Trainer create routes that call uploadAsset for the active
// provider should never route here.
export async function uploadAsset() {
  throw new Error('OpenRouter does not provide an asset upload endpoint; images are sent inline per job.');
}
