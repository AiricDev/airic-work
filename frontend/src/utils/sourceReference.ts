import { isSafePath, omFileLink } from './omRepository';
export type ReferenceTemplates = Record<string, Record<string, string>>;
export interface SourceReference { system?: string; objectId?: string; version?: string; location?: string }

export function referenceTemplates(): ReferenceTemplates {
  try { return JSON.parse(import.meta.env.VITE_REFERENCE_TEMPLATES ?? '{}'); } catch { return {}; }
}
function webUrl(value: string): string | undefined {
  try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) && !u.username && !u.password ? u.href : undefined; } catch { return; }
}
/** Resolve only explicit web URLs, pinned Git files or host-configured route templates; never guess business routes. */
export function sourceReferenceLink(source: SourceReference, executionId: string, fixedSha: string, scope: string, templates: ReferenceTemplates): string | undefined {
  const object = source.objectId;
  if (typeof object !== 'string') return;
  const direct = webUrl(object);
  if (direct) return direct;
  if (/^[a-z][a-z0-9+.-]*:/i.test(object)) return;
  if (typeof source.system !== 'string') return;
  if (source.system.startsWith('git:')) {
    const marker = source.system.lastIndexOf('@');
    const sha = marker >= 0 ? source.system.slice(marker + 1) : fixedSha;
    const path = object.split('#')[0];
    if (!/^[a-f0-9]{40,64}$/i.test(sha) || !isSafePath(path) || /[\\\x00-\x1f]/.test(path)) return;
    return omFileLink(sha, path, executionId);
  }
  const slash = object.indexOf('/');
  if (slash < 1) return;
  const kind = object.slice(0, slash), id = object.slice(slash + 1);
  const template = templates?.[source.system]?.[kind];
  if (typeof template !== 'string' || !id) return;
  let fields: Record<string, unknown>;
  try { const parsed = JSON.parse(scope); fields = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}; } catch { fields = {}; }
  fields = { ...fields, id };
  let missing = false;
  const target = template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key: string) => {
    const value = fields[key];
    if (typeof value !== 'string' || !value) { missing = true; return ''; }
    return encodeURIComponent(value);
  });
  return missing ? undefined : webUrl(target);
}
