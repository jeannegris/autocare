// Central config for runtime URLs
// Resolve runtime prefix for API when the app is served under a subpath (like /autocare/)
export const APP_BASE_PATH = (() => {
  try {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/autocare')) {
      return '/autocare';
    }
  } catch {}
  return '';
})();

// API_PREFIX: used by fetch wrappers and axios
export const API_PREFIX = (() => {
  // In dev (served at /), use /api
  if (APP_BASE_PATH === '') return '/api';
  // When served under /autocare, backend is proxied at /autocare-api
  if (APP_BASE_PATH === '/autocare') return '/autocare-api';
  return '/api';
})();

export function apiPath(path: string) {
  if (!path.startsWith('/')) path = '/' + path;
  return `${API_PREFIX}${path}`;
}
