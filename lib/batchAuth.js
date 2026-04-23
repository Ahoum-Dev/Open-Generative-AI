export function getApiKey(request) {
  const headerKey = request.headers.get('x-api-key');
  if (headerKey) return headerKey;
  const cookieKey = request.cookies.get('muapi_key')?.value;
  if (cookieKey) return cookieKey;
  return process.env.MUAPI_API_KEY || null;
}
