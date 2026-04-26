// Provider registry. Each adapter exports the shape:
//   {
//     id: string,                       // matches Batch.provider
//     label: string,                    // human label for UI
//     defaultModel: string,             // hard-coded "seedance i2v" per provider
//
//     async submit({ apiKey, prompt, imageUrl, duration, quality, aspectRatio, model }):
//       returns { providerRequestId, videoUrl? }
//       - if videoUrl is returned, the job is done synchronously and won't be polled
//       - if only providerRequestId is returned, the worker polls via pollResult
//
//     async pollResult({ apiKey, providerRequestId }):
//       returns { status: 'pending'|'done'|'failed', videoUrl?, error? }
//
//     async uploadAsset({ apiKey, file, fileName }):
//       returns { url }      // CDN URL for the provider, used as imageUrl
//
//     async estimateCost({ apiKey, batch }):
//       returns { perJob, currency, raw }      // per-job cost in batch.duration/quality
//   }

import * as muapi from './muapi.js';

const REGISTRY = {
  [muapi.id]: muapi,
};

export function getProvider(id) {
  const provider = REGISTRY[id];
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

export function listProviders() {
  return Object.values(REGISTRY).map((p) => ({
    id: p.id,
    label: p.label,
    defaultModel: p.defaultModel,
  }));
}
