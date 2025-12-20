// Shared JWT auth helpers
export function isTokenExpired(token) {
  try {
    const parts = String(token).split('.');
    if (parts.length < 2) return true;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64Url.length / 4) * 4, '=');
    const payloadStr = typeof atob === 'function' ? atob(base64) : Buffer.from(base64, 'base64').toString('binary');
    const payload = JSON.parse(payloadStr || '{}');
    const exp = Number(payload.exp);
    if (!Number.isFinite(exp)) return true;
    const nowSec = Math.floor(Date.now() / 1000);
    return nowSec >= exp;
  } catch (_) {
    return true;
  }
}

export function clearAuth() {
  try { localStorage.removeItem('token'); } catch {}
  try { localStorage.removeItem('user'); } catch {}
}

export function ensureValidTokenOrRedirect(navigate) {
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  if (!token || !userStr || isTokenExpired(token)) {
    clearAuth();
    if (navigate) navigate('/login', { replace: true });
    return false;
  }
  return true;
}
