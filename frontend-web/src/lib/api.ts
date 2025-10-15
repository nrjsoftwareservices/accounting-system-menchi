export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000/api/v1';

export async function api(endpoint: string, options: RequestInit = {}) {
  const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
  const orgId = (typeof window !== 'undefined') ? localStorage.getItem('org_id') : null;
  const isAuthPath = endpoint.startsWith('/auth/');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(!isAuthPath && token ? { Authorization: `Bearer ${token}` } : {}),
    ...(!isAuthPath && orgId ? { 'X-Org-Id': orgId } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!res.ok) {
    // Read the body exactly once to avoid "body stream already read" errors
    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();
    let payload: any = null;
    if (contentType.includes('application/json')) {
      try { payload = JSON.parse(raw); } catch { /* malformed JSON */ }
    } else if (raw && !raw.trim().startsWith('<')) {
      // treat non-HTML plain text as message
      payload = { message: raw };
    }
    const message = (payload?.message && String(payload.message)) || `${res.status} ${res.statusText || 'Request failed'}`;
    const err: any = new Error(message);
    if (payload?.errors) err.errors = payload.errors;
    err.status = res.status;
    // Keep raw body for debugging but avoid showing it by default
    err.raw = raw;
    throw err;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res.text();
}
