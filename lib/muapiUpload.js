const MUAPI_BASE = 'https://api.muapi.ai';

export async function uploadFileToMuapi(apiKey, file) {
  if (!apiKey) {
    throw new Error('Missing MuAPI API key');
  }
  if (!file) {
    throw new Error('Missing file');
  }

  const form = new FormData();
  form.append('file', file);

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
  return url;
}
