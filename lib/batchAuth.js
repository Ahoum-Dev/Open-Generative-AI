// Resolve the API key for a request, optionally narrowed to a provider.
// Priority order:
//   1. x-api-key request header (the wizard / browser sends this)
//   2. provider-specific cookie (e.g. segmind_key)
//   3. legacy muapi_key cookie when provider is muapi (kept for compatibility)
//   4. provider-specific env var (MUAPI_API_KEY / SEGMIND_API_KEY / ...)
export function getApiKey(request, provider = null) {
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey;

  if (provider) {
    const cookieKey = request.cookies.get(`${provider}_key`)?.value;
    if (cookieKey) return cookieKey;
    if (provider === 'muapi') {
      const legacy = request.cookies.get('muapi_key')?.value;
      if (legacy) return legacy;
    }
    const envKey = process.env[`${provider.toUpperCase()}_API_KEY`];
    if (envKey) return envKey;
    return null;
  }

  // No provider scope — fall back to any provider's cookie/env (worker-style).
  for (const p of ['muapi', 'segmind', 'byteplus', 'openrouter']) {
    const c = request.cookies.get(`${p}_key`)?.value;
    if (c) return c;
  }
  return process.env.MUAPI_API_KEY || null;
}
