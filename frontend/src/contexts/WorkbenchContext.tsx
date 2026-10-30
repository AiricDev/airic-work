import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { DemoSettings, DemoUser, Draft, LookupResult, SubmitOutcome, WorkbenchState } from '../types/workbench';
import { demoUsers } from '../data/users';
import { createInitialState, defaultSettings, workbenchReducer } from '../utils/workbenchReducer';
import { buildUserDecision, createId, validateSubmission } from '../utils/decisionService';
import { nowIso } from '../utils/time';

const STATE_KEY = 'airic-work-demo-state-v4';
const DRAFTS_KEY = 'airic-work-demo-drafts-v4';

interface WorkbenchContextValue {
  state: WorkbenchState;
  drafts: Record<string, Draft>;
  currentUser: DemoUser;
  setUser: (id: string) => void;
  updateSettings: (patch: Partial<DemoSettings>) => void;
  resetDemo: () => void;
  saveDraft: (draft: Draft) => void;
  discardDraft: (requestId: string) => void;
  markViewed: (requestId: string) => void;
  submitUserDecision: (requestId: string, draft: Draft) => Promise<SubmitOutcome>;
  lookupSubmission: (requestId: string, key: string) => LookupResult;
  simulateExternalResolve: (requestId: string) => void;
  simulateContextUpdate: (requestId: string) => void;
  requestCancel: (executionId: string) => void;
  queryCancel: (executionId: string) => void;
  sendSteering: (executionId: string, text: string, files?: import("../types/workbench").PrototypeFile[]) => void;
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null);

export function WorkbenchProvider({ children }: {children: React.ReactNode;}) {
  const [state, dispatch] = useReducer(workbenchReducer, undefined, loadState);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(loadDrafts);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scheduled = useRef(new Set<string>());

  useEffect(() => {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  }, [drafts]);

  useEffect(() => {
    state.requests.forEach((r) => {
      const key = `follow-${r.id}`;
      if (r.followUp?.status === 'confirming' && !scheduled.current.has(key)) {
        scheduled.current.add(key);
        window.setTimeout(() => {
          dispatch({ type: 'FOLLOW_UP_CONFIRMED', requestId: r.id });
          scheduled.current.delete(key);
        }, 3000);
      }
    });
    state.executions.forEach((e) => {
      const key = `cancel-${e.id}`;
      if (e.cancellation?.status === 'requested' && !scheduled.current.has(key)) {
        scheduled.current.add(key);
        window.setTimeout(() => {
          dispatch({ type: 'CANCEL_RESOLVED', executionId: e.id, delayed: stateRef.current.settings.cancelDelayed });
          scheduled.current.delete(key);
        }, 3500);
      }
    });
  }, [state.requests, state.executions]);

  const currentUser = demoUsers.find((u) => u.id === state.userId) ?? demoUsers[0];

  const setUser = useCallback((id: string) => dispatch({ type: 'SET_USER', userId: id }), []);
  const updateSettings = useCallback((patch: Partial<DemoSettings>) => dispatch({ type: 'UPDATE_SETTINGS', patch }), []);
  const resetDemo = useCallback(() => {
    dispatch({ type: 'RESET' });
    setDrafts({});
  }, []);
  const saveDraft = useCallback((draft: Draft) => setDrafts((d) => ({ ...d, [draft.requestId]: draft })), []);
  const discardDraft = useCallback(
    (requestId: string) =>
    setDrafts((d) => {
      const next = { ...d };
      delete next[requestId];
      return next;
    }),
    []
  );
  const markViewed = useCallback((requestId: string) => dispatch({ type: 'MARK_VIEWED', requestId }), []);

  const submitUserDecision = useCallback(async (requestId: string, draft: Draft): Promise<SubmitOutcome> => {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const s = stateRef.current;
    const req = s.requests.find((r) => r.id === requestId);
    const user = demoUsers.find((u) => u.id === s.userId) ?? demoUsers[0];
    if (!req) return { kind: 'failed', message: '请求不存在或已不可见，未被接受。' };
    const invalid = validateSubmission(req, draft, user);
    if (invalid) return invalid;
    if (s.settings.submitMode === 'failed') {
      return { kind: 'failed', message: '服务暂时不可用（模拟），本次提交未被接受。' };
    }
    const userDecision = buildUserDecision(req, draft, user, '工作台');
    if (s.settings.submitMode === 'unknown') {
      window.setTimeout(() => dispatch({ type: 'RECORD_USER_DECISION', userDecision }), 4000);
      return { kind: 'unknown' };
    }
    dispatch({ type: 'RECORD_USER_DECISION', userDecision });
    return { kind: 'accepted', userDecision };
  }, []);

  const lookupSubmission = useCallback((requestId: string, key: string): LookupResult => {
    const req = stateRef.current.requests.find((r) => r.id === requestId);
    if (!req?.userDecision) return { status: 'notFound' };
    return req.userDecision.idempotencyKey === key ?
    { status: 'found', userDecision: req.userDecision } :
    { status: 'other', userDecision: req.userDecision };
  }, []);

  const simulateExternalResolve = useCallback((requestId: string) => {
    const req = stateRef.current.requests.find((r) => r.id === requestId);
    if (!req || req.status === 'answered') return;
    const option = req.brief.options.find((o) => o.id === req.brief.recommendation?.optionId) ?? req.brief.options[0];
    const content =
    req.kind === 'judgment' ?
    option?.label ?? '已在业务系统作出判断' :
    req.kind === 'fact' ?
    '业务人员已在业务系统补充相关事实（模拟）' :
    `授权：${req.brief.authorization?.action ?? '指定操作'}（业务系统内授权，模拟）`;
    dispatch({
      type: 'RECORD_USER_DECISION',
      userDecision: {
        id: createId('RS'),
        requestId: req.id,
        action: req.kind,
        choiceId: req.kind === 'judgment' ? option?.id : undefined,
        choiceLabel: req.kind === 'judgment' ? option?.label : undefined,
        content,
        reason: req.kind === 'judgment' ? '在业务系统中依据同一 Brief 作出（模拟）' : undefined,
        source: req.kind === 'fact' ? 'CertLab（模拟）业务记录' : undefined,
        actorId: req.ownerId,
        actorName: demoUsers.find((u) => u.id === req.ownerId)?.name ?? req.ownerId,
        channel: '业务系统',
        at: nowIso(),
        basisVersion: req.version,
        idempotencyKey: createId('BIZ')
      }
    });
  }, []);

  const simulateContextUpdate = useCallback((requestId: string) => dispatch({ type: 'CONTEXT_UPDATE', requestId }), []);

  const requestCancel = useCallback(
    (executionId: string) => {
      dispatch({ type: 'REQUEST_CANCEL', executionId, userName: currentUser.name });
    },
    [currentUser.name]
  );

  const queryCancel = useCallback((executionId: string) => {
    const s = stateRef.current;
    const exec = s.executions.find((e) => e.id === executionId);
    if (exec?.cancellation?.status === 'delayed' && !s.settings.cancelDelayed) {
      dispatch({ type: 'CANCEL_RESOLVED', executionId, delayed: false });
    } else {
      dispatch({ type: 'CANCEL_CHECKED', executionId });
    }
  }, []);

  const value = useMemo<WorkbenchContextValue>(
    () => ({
      state,
      drafts,
      currentUser,
      setUser,
      updateSettings,
      resetDemo,
      saveDraft,
      discardDraft,
      markViewed,
      submitUserDecision,
      lookupSubmission,
      simulateExternalResolve,
      simulateContextUpdate,
      requestCancel,
      queryCancel,
      sendSteering: (executionId, text, files) => dispatch({ type: 'STEERING', executionId, text, files, userId: stateRef.current.userId })
    }),
    [state, drafts, currentUser, setUser, updateSettings, resetDemo, saveDraft, discardDraft, markViewed, submitUserDecision, lookupSubmission, simulateExternalResolve, simulateContextUpdate, requestCancel, queryCancel]
  );

  return <WorkbenchContext.Provider value={value}>{children}</WorkbenchContext.Provider>;
}

export function useWorkbench(): WorkbenchContextValue {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) throw new Error('useWorkbench must be used inside WorkbenchProvider');
  return ctx;
}

function loadState(): WorkbenchState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkbenchState;
      if (parsed?.executions && parsed?.requests) {
        return { ...createInitialState(), ...parsed, settings: { ...defaultSettings, ...parsed.settings } };
      }
    }
  } catch {

    // ignore corrupt demo storage
  }return createInitialState();
}

function loadDrafts(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    return raw ? JSON.parse(raw) as Record<string, Draft> : {};
  } catch {
    return {};
  }
}
