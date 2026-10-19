const RETURN_KEY = 'knowgraph.auth.return';
const SPONSOR_CODE_KEY = 'knowgraph.sponsorship.pending-code';

/** Accept only local app paths, including when a return value came from a URL. */
export function safeReturnPath(value: unknown, fallback = '/home'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return fallback;
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  const hasControlCharacter = [...decoded].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
  if (decoded.startsWith('//') || decoded.includes('\\') || hasControlCharacter) return fallback;
  const url = new URL(value, 'https://local.knowgraph.invalid');
  if (url.origin !== 'https://local.knowgraph.invalid') return fallback;
  if (['/auth/callback', '/login', '/signup', '/forgot-password', '/reset-password'].includes(url.pathname)) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

// Storage can be unavailable in private or restricted browser contexts. A coupon
// is optional before login; the learner can enter it again after authentication.
function readSession(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch { /* Authentication still works without optional tab storage. */ }
}

export function rememberAuthReturn(path: string) {
  writeSession(RETURN_KEY, safeReturnPath(path));
}

export function readAuthReturn(): string | null {
  const path = readSession(RETURN_KEY);
  return path ? safeReturnPath(path) : null;
}

export function clearAuthReturn() { writeSession(RETURN_KEY, null); }

export function rememberSponsorCode(code: string) {
  writeSession(SPONSOR_CODE_KEY, code.trim().slice(0, 128));
}

export function readSponsorCode(): string { return readSession(SPONSOR_CODE_KEY) || ''; }
export function clearSponsorCode() { writeSession(SPONSOR_CODE_KEY, null); }
