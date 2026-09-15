import { useEffect, useState } from 'react';

/** Normalize '#/image-compressor' → '/image-compressor'. */
export function pathFromHash(hash: string): string {
  const raw = hash.replace(/^#/, '');
  if (!raw || raw === '/') return '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export function currentPath(): string {
  return pathFromHash(window.location.hash);
}

export function navigate(to: string): void {
  const target = to.startsWith('/') ? to : `/${to}`;
  if (pathFromHash(window.location.hash) === target) return;
  window.location.hash = `#${target}`;
}

export function useRoute(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/** Navigate home (if needed) then smooth-scroll to a home-page section. */
export function goHomeAnchor(id: string): void {
  const scroll = () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (currentPath() === '/') {
    scroll();
  } else {
    navigate('/');
    window.setTimeout(scroll, 140);
  }
}
