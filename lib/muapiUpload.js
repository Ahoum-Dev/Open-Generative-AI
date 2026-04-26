// Thin shim kept for the trainer/studio create routes. New code should use
// the provider abstraction via lib/providers/index.js.
import { uploadAsset } from '@/lib/providers/muapi';

export async function uploadFileToMuapi(apiKey, file) {
  if (!apiKey) throw new Error('Missing MuAPI API key');
  if (!file) throw new Error('Missing file');
  const { url } = await uploadAsset({ apiKey, file });
  return url;
}
