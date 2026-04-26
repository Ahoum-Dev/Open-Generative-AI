// Client-side helper for per-provider API keys. Each provider gets its own
// localStorage entry + cookie so the wizard can pick the right one based on
// which provider the user selected for a batch.

const PROVIDERS = ['muapi', 'segmind', 'byteplus', 'openrouter'];

function cookieName(providerId) {
  return `${providerId}_key`;
}

function storageName(providerId) {
  return `${providerId}_key`;
}

export function getKey(providerId) {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(storageName(providerId)) || null;
}

export function setKey(providerId, key) {
  const trimmed = (key || '').trim();
  if (!trimmed) return clearKey(providerId);
  localStorage.setItem(storageName(providerId), trimmed);
  document.cookie = `${cookieName(providerId)}=${trimmed}; path=/; max-age=31536000; SameSite=Lax`;
}

export function clearKey(providerId) {
  localStorage.removeItem(storageName(providerId));
  document.cookie = `${cookieName(providerId)}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

export function getAllKeys() {
  const out = {};
  for (const p of PROVIDERS) {
    const k = getKey(p);
    if (k) out[p] = k;
  }
  return out;
}

export function hasAnyKey() {
  return Object.keys(getAllKeys()).length > 0;
}

export { PROVIDERS };
