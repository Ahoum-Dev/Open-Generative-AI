// Server-only helper. Computes which providers are configured (cookie OR env)
// so pages can render the correct gate on the server and avoid the
// client-mount loading flash. Mirrors the priority chain in lib/batchAuth.js.

import { cookies } from 'next/headers';
import { listProviders } from '@/lib/providers';

export async function getProviderStatus() {
  const store = await cookies();
  return listProviders().map((p) => {
    const hasCookieKey = !!store.get(`${p.id}_key`)?.value;
    const hasEnvKey = !!process.env[`${p.id.toUpperCase()}_API_KEY`];
    return {
      id: p.id,
      label: p.label,
      defaultModel: p.defaultModel,
      hasKey: hasCookieKey || hasEnvKey,
      hasEnvKey,
      hasCookieKey,
    };
  });
}

export async function hasAnyProviderConfigured() {
  const status = await getProviderStatus();
  return status.some((p) => p.hasKey);
}
