// MuAPI adapter — Seedance 2.0 i2v.
// Async pattern: POST /api/v1/<model> returns request_id, then poll
// /api/v1/predictions/:id/result until completed/failed.

const MUAPI_BASE = process.env.MUAPI_BASE_URL || 'https://api.muapi.ai';

export const id = 'muapi';
export const label = 'MuAPI';
export const defaultModel = 'seedance-v2.0-i2v';

const TERMINAL_OK = new Set(['completed', 'succeeded', 'success']);
const TERMINAL_FAIL = new Set(['failed', 'error']);

export async function submit({ apiKey, prompt, imageBuffer, imageMime, imageFileName, duration, quality, aspectRatio, model }) {
  // MuAPI requires a CDN URL for the image — upload first, then submit.
  const fileBlob = new Blob([imageBuffer], { type: imageMime || 'image/jpeg' });
  const { url: imageUrl } = await uploadAsset({
    apiKey,
    file: fileBlob,
    fileName: imageFileName,
  });

  const payload = {
    prompt,
    images_list: [imageUrl],
    aspect_ratio: aspectRatio,
    duration,
    quality,
  };

  const res = await fetch(`${MUAPI_BASE}/api/v1/${model || defaultModel}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MuAPI ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const providerRequestId = data.request_id || data.id;
  if (!providerRequestId) {
    throw new Error(`MuAPI: no request_id in response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { providerRequestId };
}

export async function pollResult({ apiKey, providerRequestId }) {
  const res = await fetch(`${MUAPI_BASE}/api/v1/predictions/${providerRequestId}/result`, {
    headers: { 'x-api-key': apiKey },
  });
  if (!res.ok) {
    if (res.status >= 500) return { status: 'pending' }; // transient, retry next tick
    const text = await res.text().catch(() => '');
    return { status: 'failed', error: `Poll ${res.status}: ${text.slice(0, 200)}` };
  }
  const data = await res.json();
  const s = data.status?.toLowerCase();
  if (TERMINAL_OK.has(s)) {
    const videoUrl = data.outputs?.[0] || data.url || data.output?.url || data.video_url || null;
    return { status: 'done', videoUrl };
  }
  if (TERMINAL_FAIL.has(s)) {
    return { status: 'failed', error: data.error || `MuAPI status: ${s}` };
  }
  return { status: 'pending' };
}

export async function uploadAsset({ apiKey, file, fileName }) {
  const form = new FormData();
  // file is either a browser File (in API routes) or a Blob (in worker re-upload)
  if (fileName && !file.name) {
    form.append('file', file, fileName);
  } else {
    form.append('file', file);
  }

  const res = await fetch(`${MUAPI_BASE}/api/v1/upload_file`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MuAPI upload failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const url = data.url || data.file_url || data?.data?.url;
  if (!url) {
    throw new Error(`MuAPI upload returned no URL: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { url };
}

export async function estimateCost({ apiKey, batch }) {
  const payload = {
    aspect_ratio: batch.aspectRatio,
    duration: batch.duration,
    quality: batch.quality,
  };
  const res = await fetch(`${MUAPI_BASE}/api/v1/app/calculate_dynamic_cost`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ task_name: batch.model, payload }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`MuAPI cost endpoint returned ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const perJob =
    typeof data.cost === 'number' ? data.cost
      : typeof data.price === 'number' ? data.price
        : typeof data.amount === 'number' ? data.amount
          : null;
  if (perJob === null) {
    throw new Error(`Could not extract cost from MuAPI response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return { perJob, currency: data.currency || 'USD', raw: data };
}
