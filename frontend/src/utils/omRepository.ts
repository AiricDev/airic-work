import type { GitCommit, RepoFile } from '../types/platform';
import { omCommits } from '../data/omRepository';

export function shortSha(sha: string): string {
  return sha.slice(0, 12);
}

export function findCommit(ref: string | null | undefined): GitCommit | undefined {
  if (!ref) return undefined;
  return omCommits.find((c) => c.sha === ref || c.sha.startsWith(ref));
}

/** A commit is visible only once a sync has confirmed it (or a later commit). */
export function isSynced(sha: string, confirmedSha: string): boolean {
  const i = omCommits.findIndex((c) => c.sha === sha);
  const j = omCommits.findIndex((c) => c.sha === confirmedSha);
  return i >= 0 && j >= 0 && i <= j;
}

/** Commits up to and including `sha`, newest first. */
export function commitsUpTo(sha: string): GitCommit[] {
  const idx = omCommits.findIndex((c) => c.sha === sha);
  if (idx < 0) return [];
  return omCommits.slice(0, idx + 1).reverse();
}

const cache = new Map<string, Map<string, RepoFile>>();

export function snapshotAt(sha: string): Map<string, RepoFile> {
  const hit = cache.get(sha);
  if (hit) return hit;
  const files = new Map<string, RepoFile>();
  for (const c of omCommits) {
    for (const ch of c.changes) {
      if (ch.status === 'deleted') files.delete(ch.path);else
      files.set(ch.path, { path: ch.path, content: ch.content, binary: ch.binary });
    }
    if (c.sha === sha) break;
  }
  cache.set(sha, files);
  return files;
}

export function fileAt(sha: string, path: string): RepoFile | undefined {
  return snapshotAt(sha).get(path);
}

export function parentContent(commit: GitCommit, path: string): string | undefined {
  const parent = commit.parents[0];
  return parent ? fileAt(parent, path)?.content : undefined;
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
export function searchSnapshot(sha: string, query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  snapshotAt(sha).forEach((file) => {
    const pathHit = file.path.toLowerCase().includes(q);
    if (!file.content) {
      if (pathHit) hits.push({ path: file.path, lines: [], count: 1 });
      return;
    }
    const lines: {no: number;text: string;}[] = [];
    let count = 0;
    file.content.split('\n').forEach((text, idx) => {
      const lower = text.toLowerCase();
      let from = lower.indexOf(q);
      if (from >= 0) lines.push({ no: idx + 1, text });
      while (from >= 0) {
        count++;
        from = lower.indexOf(q, from + q.length);
      }
    });
    if (count > 0 || pathHit) hits.push({ path: file.path, lines: lines.slice(0, 5), count: Math.max(count, 1) });
  });
  return hits.sort((x, y) => y.count - x.count);
}

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

export function omFileLink(sha: string, path: string): string {
  return `/om?commit=${shortSha(sha)}&path=${encodeURIComponent(path)}`;
}