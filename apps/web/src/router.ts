export function navigate(hash: string) { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; }
export function parseHash(): { path: string[] } {
  const raw = location.hash.replace(/^#\/?/, '');
  return { path: raw.split('/').filter(Boolean).map(decodeURIComponent) };
}
