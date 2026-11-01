import type { ActionType, DecisionRequest, Draft } from '../types/workbench';

export function responseText(draft: Draft): string {
  return draft.action === 'judgment' ? draft.reason : draft.action === 'investigation' ? draft.investigation : draft.action === 'authorization' ? draft.note : draft.fact;
}
/** Keep one visible input when switching choices, while retaining the existing draft/submission contract. */
export function responsePatch(text: string, action: ActionType | null): Partial<Draft> {
  return { action, reason: text, fact: text, investigation: text, note: '' };
}
export function selectResponse(draft: Draft, action: ActionType | null, choiceId = ''): Partial<Draft> {
  const text = responseText(draft);
  return { ...responsePatch(text, action), ...(action === 'authorization' ? { note: text } : {}), choiceId };
}
/** Pending intent is immutable: UI changes never rebuild an unknown submission. */
export function decisionPayload(draft: Draft, request?: DecisionRequest) {
  if (draft.pending) return draft.pending;
  const option = draft.action === 'judgment' ? request?.brief.options.find(o => o.id === draft.choiceId) : undefined;
  const text = responseText(draft).trim();
  const auth = draft.action === 'authorization' ? request?.brief.authorization : undefined;
  return {
    contextRevision: draft.baseVersion,
    text: [draft.action === 'investigation' ? ['需要进一步调查', text].filter(Boolean).join('：') : auth ? [`授权：${auth.object} · ${auth.action} · ${auth.scope}`, text].filter(Boolean).join('\n') : text, draft.factSource]
      .filter(s => s?.trim()).join('\n\n'),
    files: (draft.files ?? []).map(f => f.id!).filter(Boolean),
    ...(option ? { optionId: option.id } : {}),
    ...(draft.correctionOf ? { correctionOf: draft.correctionOf } : {}),
  };
}
