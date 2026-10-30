import { describe, it, expect } from 'vitest';
import { createInitialState, workbenchReducer } from '../src/utils/workbenchReducer';
import { createEmptyDraft, buildUserDecision, validateSubmission } from '../src/utils/decisionService';
import { getVisibleExecutions } from '../src/utils/selectors';
import { demoUsers } from '../src/data/users';

describe('confirmed ontology in prototype', () => {
 it('submission answers immediately before Agent continuation', () => {
  const s = createInitialState(); const r = s.requests.find(r => r.status === 'pending')!;
  const d = createEmptyDraft(r); d.action = 'fact'; d.fact = '现场观察';
  const u = demoUsers.find(u => u.id === r.ownerId)!;
  const decision = buildUserDecision(r, d, u, '工作台');
  const next = workbenchReducer(s, { type: 'RECORD_USER_DECISION', userDecision: decision });
  expect(next.requests.find(x => x.id === r.id)?.status).toBe('answered');
  expect(next.requests.find(x => x.id === r.id)?.followUp?.status).toBe('confirming');
  expect(workbenchReducer(next, { type: 'RECORD_USER_DECISION', userDecision: decision })).toBe(next);
 });
 it('a context refresh does not reject a user response', () => {
  const s = createInitialState(); const r = s.requests.find(r => r.status === 'pending')!;
  const d = createEmptyDraft(r); d.action = r.allowedActions[0]; d.baseVersion = r.version - 1;
  expect(validateSubmission(r, d, demoUsers.find(u => u.id === r.ownerId)!)).toBeNull();
 });
 it('steering continues the same execution and keeps fixed OM and history', () => {
  const s = createInitialState(); const e = s.executions[0]; e.ended = true;
  const next = workbenchReducer(s, { type: 'STEERING', executionId: e.id, text: '继续核查', userId: e.ownerId, files: [{ name: 'a.txt', size: 1, content: 'data:text/plain;base64,YQ==' }] });
  const current = next.executions[0];
  expect(current.id).toBe(e.id); expect(current.ended).toBe(false); expect(current.omCommit).toBe(e.omCommit);
  expect(current.events.length).toBe(e.events.length + 1); expect(current.uploads?.[0].name).toBe('a.txt');
 });
 it('corrections append history while keeping the request answered', () => {
  const s = createInitialState(); const r = s.requests.find(r => r.status === 'pending')!;
  const u = demoUsers.find(u => u.id === r.ownerId)!; const d = createEmptyDraft(r); d.action = 'fact'; d.fact = '原观察';
  const first = buildUserDecision(r, d, u, '工作台');
  const next = workbenchReducer(s, {type:'RECORD_USER_DECISION',userDecision:first});
  const correction = {...first,id:'UD-correction',idempotencyKey:'correction',content:'更正观察'};
  const corrected = workbenchReducer(next,{type:'RECORD_USER_DECISION',userDecision:correction}).requests.find(x=>x.id===r.id)!;
  expect(corrected.status).toBe('answered'); expect(corrected.decisionHistory?.map(d=>d.content)).toEqual(['原观察','更正观察']);
 });
 it('another user cannot send a message or see same-project executions', () => {
  const s = createInitialState(); const e = s.executions[0]; const other = demoUsers.find(u => u.id !== e.ownerId)!;
  expect(workbenchReducer(s, { type: 'STEERING', executionId: e.id, text: '继续', userId: other.id })).toBe(s);
  expect(getVisibleExecutions(s.executions, other).every(x => x.ownerId === other.id)).toBe(true);
 });
});
