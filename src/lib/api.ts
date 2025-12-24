const envBase = import.meta.env.VITE_API_BASE?.trim();
const API_BASE = envBase ? envBase.replace(/\/+$/, '') : '';

export function apiUrl(path: string): string {
  if (!path) return API_BASE || '';
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}
