import type { DecisionRequest, DemoUser, Draft, Resolution, ResolutionChannel, SubmitOutcome } from '../types/workbench';
import { demoUsers } from '../data/users';
import { nowIso } from './time';

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function userName(id: string): string {
  return demoUsers.find((u) => u.id === id)?.name ?? id;
}

export function canResolveRequest(request: DecisionRequest, user: DemoUser): boolean {
  return request.ownerId === user.id;
}

export function createEmptyDraft(request: DecisionRequest): Draft {
  return {
    requestId: request.id,
    action: null,
    choiceId: '',
    reason: '',
    fact: '',
    factSource: '',
    investigation: '',
    authorizeConfirm: false,
    note: '',
    baseVersion: request.version,
    updatedAt: nowIso(),
    idempotencyKey: createId('IDEM')
  };
}

export function draftHasContent(d: Draft): boolean {
  return Boolean(
    d.action ||
    d.choiceId ||
    d.reason.trim() ||
    d.fact.trim() ||
    d.factSource.trim() ||
    d.investigation.trim() ||
    d.note.trim() ||
    d.authorizeConfirm
  );
}

export function validateDraft(d: Draft, request: DecisionRequest): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!d.action) {
    errors.action = '请选择处理方式';
    return errors;
  }
  if (!request.allowedActions.includes(d.action)) errors.action = '此请求不支持该处理方式';
  if (d.action === 'judgment') {
    if (!d.choiceId) errors.choiceId = '请选择一个方案';
    if (!d.reason.trim()) errors.reason = '请说明判断理由';
  }
  if (d.action === 'fact') {
    if (!d.fact.trim()) errors.fact = '请填写补充的事实内容';
    if (!d.factSource.trim()) errors.factSource = '请注明事实来源';
  }
  if (d.action === 'authorization' && !d.authorizeConfirm) {
    errors.authorizeConfirm = '请确认授权的对象、动作与范围';
  }
  if (d.action === 'investigation' && !d.investigation.trim()) {
    errors.investigation = '请说明需要调查的问题';
  }
  return errors;
}

export function validateSubmission(request: DecisionRequest, draft: Draft, user: DemoUser): SubmitOutcome | null {
  if (!canResolveRequest(request, user)) {
    return { kind: 'forbidden', reason: `你当前的身份（${user.name}）不是此请求的归属人，服务拒绝了提交。` };
  }
  if (request.status === 'resolved' && request.resolution) {
    return request.resolution.idempotencyKey === draft.idempotencyKey ?
    { kind: 'duplicate', resolution: request.resolution } :
    { kind: 'conflict', resolution: request.resolution };
  }
  if (draft.baseVersion !== request.version) {
    return { kind: 'stale', changes: request.changes.filter((c) => c.version > draft.baseVersion) };
  }
  if (!draft.action || !request.allowedActions.includes(draft.action)) {
    return { kind: 'failed', message: '处理方式不适用于此请求，未被接受。' };
  }
  return null;
}

export function buildResolution(
request: DecisionRequest,
draft: Draft,
actor: {id: string;name: string;},
channel: ResolutionChannel)
: Resolution {
  const action = draft.action ?? 'fact';
  const option = request.brief.options.find((o) => o.id === draft.choiceId);
  const auth = request.brief.authorization;
  let content = '';
  if (action === 'judgment') content = option?.label ?? '';
  if (action === 'fact') content = draft.fact.trim();
  if (action === 'authorization') content = auth ? `授权：${auth.action}（${auth.scope}）` : '授权';
  if (action === 'investigation') content = draft.investigation.trim();
  return {
    id: createId('RS'),
    requestId: request.id,
    action,
    choiceId: option?.id,
    choiceLabel: option?.label,
    content,
    reason: action === 'judgment' ? draft.reason.trim() : action === 'authorization' ? draft.note.trim() || undefined : undefined,
    source: action === 'fact' ? draft.factSource.trim() : undefined,
    actorId: actor.id,
    actorName: actor.name,
    channel,
    at: nowIso(),
    basisVersion: draft.baseVersion,
    idempotencyKey: draft.idempotencyKey
  };
}