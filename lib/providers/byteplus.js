// BytePlus ModelArk adapter — Seedance 2.0 i2v.
//
// Pattern (per docs at docs.byteplus.com/en/docs/ModelArk/1520757):
//   POST {base}/api/v3/contents/generations/tasks
//     body: { model, content: [text, image_url], resolution, ratio, duration, watermark }
//     auth: Authorization: Bearer <ARK_API_KEY>
//     image: passed inline as base64 data URL inside content[].image_url.url
//   → returns { id } (task id)
//
//   GET {base}/api/v3/contents/generations/tasks/{id}
//   → returns { status: queued|running|succeeded|failed|expired, ... }
//   When succeeded, the response carries the video URL. Field name varies by
//   ModelArk version — we probe content.video_url, video_url top-level, and
//   content[].video_url[].url to be defensive.
//
// Region: ap-southeast hosts all video models. Override via BYTEPLUS_REGION
// (currently no other region exposes the seedance 2.0 video models).

import { TerminalProviderError } from './errors.js';

const REGION = process.env.BYTEPLUS_REGION || 'ap-southeast';
const BASE = `https://ark.${REGION}.bytepluses.com/api/v3`;

export const id = 'byteplus';
export const label = 'BytePlus ModelArk';
export const defaultModel = 'dreamina-seedance-2-0-260128';

const TERMINAL_OK = new Set(['succeeded', 'success', 'completed']);
const TERMINAL_FAIL = new Set(['failed', 'expired', 'cancelled', 'canceled']);

export async function submit({ apiKey, prompt, imageBuffer, imageMime, duration, aspectRatio, resolution, model }) {
  const dataUrl = `data:${imageMime || 'image/jpeg'};base64,${imageBuffer.toString('base64')}`;

  const payload = {
    model: model || defaultModel,
    content: [
      { type: 'text', text: prompt },
      {
        type: 'image_url',
        image_url: { url: dataUrl },
        role: 'first_frame',
      },
    ],
    resolution: resolution || '480p',
    ratio: aspectRatio,
    duration,
    watermark: false,
  };

  const res = await fetch(`${BASE}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const msg = `BytePlus ${res.status}: ${text.slice(0, 300)}`;
    if (res.status >= 400 && res.status < 500) {
      throw new TerminalProviderError(msg, { billed: false });
    }
    throw new Error(msg);
  }
  const data = await res.json();
  const providerRequestId = data.id;
  if (!providerRequestId) {
    throw new TerminalProviderError(
      `BytePlus: no task id in response: ${JSON.stringify(data).slice(0, 200)}`,
      { billed: null },
    );
  }
  return { providerRequestId };
}

export async function pollResult({ apiKey, providerRequestId }) {
  const res = await fetch(`${BASE}/contents/generations/tasks/${providerRequestId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    if (res.status >= 500) return { status: 'pending' };
    const text = await res.text().catch(() => '');
    throw new TerminalProviderError(
      `BytePlus poll ${res.status}: ${text.slice(0, 200)}`,
      { billed: null },
    );
  }
  const data = await res.json();
  const s = (data.status || '').toLowerCase();
  if (TERMINAL_OK.has(s)) {
    const videoUrl = extractVideoUrl(data);
    if (!videoUrl) {
      throw new TerminalProviderError(
        `BytePlus succeeded but no video URL found: ${JSON.stringify(data).slice(0, 300)}`,
        { billed: true },
      );
    }
    return { status: 'done', videoUrl };
  }
  if (TERMINAL_FAIL.has(s)) {
    throw new TerminalProviderError(
      data.error?.message || data.message || `BytePlus status: ${s}`,
      { billed: s === 'failed' },
    );
  }
  return { status: 'pending' };
}

function extractVideoUrl(data) {
  // Probe known shapes — docs page didn't show the response schema explicitly.
  if (typeof data.video_url === 'string') return data.video_url;
  if (typeof data.content?.video_url === 'string') return data.content.video_url;
  if (Array.isArray(data.content)) {
    for (const item of data.content) {
      if (item?.video_url?.url) return item.video_url.url;
      if (typeof item?.video_url === 'string') return item.video_url;
    }
  }
  if (data.output?.video_url) return data.output.video_url;
  if (Array.isArray(data.outputs) && typeof data.outputs[0] === 'string') return data.outputs[0];
  return null;
}

// Used by trainer/studio create routes. BytePlus has no public storage
// upload endpoint — its image_url field accepts base64 data URLs directly,
// so we don't pre-upload. Just return a placeholder; the per-job submit
// embeds the image inline.
export async function uploadAsset({ file }) {
  // We can't return a URL because BytePlus has no asset host; the trainer
  // route only uses this when MUAPI is the active uploader. For pure
  // BytePlus deployments this is never called — the worker reads from disk.
  throw new Error('BytePlus does not provide an asset upload endpoint; trainer images stay local and are sent inline per job.');
}
