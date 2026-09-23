export async function checkHealth(baseUrl: string, signal: AbortSignal): Promise<void> {
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error('API_URL_UNAVAILABLE');
  }
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/health`, { signal });
  const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (response.status !== 200 || contentType !== 'application/json') {
    throw new Error('API_RESPONSE_INVALID');
  }
  const body: unknown = await response.json();
  if (body === null || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).length !== 1 || !('status' in body) || body.status !== 'ok') {
    throw new Error('API_RESPONSE_INVALID');
  }
}
