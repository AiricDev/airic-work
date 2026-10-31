

export function shortSha(sha: string): string {
  return sha.slice(0, 12);
}

export interface DiffLine {
  type: 'same' | 'add' | 'del';
  text: string;
  oldNo?: number;
  newNo?: number;
}

/** Simple LCS-based line diff (files are small). */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before ? before.split('\n') : [];
  const b = after ? after.split('\n') : [];
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ type: 'same', text: a[i], oldNo: i + 1, newNo: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: 'del', text: a[i], oldNo: i + 1 });
      i++;
    } else {
      out.push({ type: 'add', text: b[j], newNo: j + 1 });
      j++;
    }
  }
  while (i < n) out.push({ type: 'del', text: a[i], oldNo: ++i });
  while (j < m) out.push({ type: 'add', text: b[j], newNo: ++j });
  return out;
}

export interface SearchHit {
  path: string;
  lines: {no: number;text: string;}[];
  count: number;
}

/** Plain full-text search over a synced commit snapshot (no semantic / vector index). */
/**
 * Resolve a relative link within the same repository. Returns null for external links,
 * absolute URLs, or paths escaping the repository root.
 */
export function resolveRelative(fromPath: string, href: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//') || href.startsWith('/') || href.startsWith('#')) return null;
  const clean = href.split('#')[0].split('?')[0];
  const parts = fromPath.split('/').slice(0, -1);
  for (const seg of clean.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
    } else parts.push(seg);
  }
  return parts.join('/');
}

export function isSafePath(path: string): boolean {
  return !path.split('/').some((s) => s === '..' || s === '') && !path.startsWith('/');
}

export function omFileLink(sha: string, path: string, executionId?: string): string {
  return `/om?commit=${sha}&path=${encodeURIComponent(path)}${executionId ? `&executionId=${encodeURIComponent(executionId)}` : ''}`;
}
