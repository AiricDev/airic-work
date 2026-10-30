import type { DemoSettings, Execution, ExecEvent, DecisionRequest, UserDecision, WorkbenchState } from '../types/workbench';
import { executions as seedExecutions } from '../data/executions';
import { decisionRequests as seedRequests } from '../data/decisionRequests';
import { actionLabels } from './labels';
import { createId } from './decisionService';
import { nowIso } from './time';

export type WorkbenchAction =
{type: 'SET_USER';userId: string;} |
{type: 'UPDATE_SETTINGS';patch: Partial<DemoSettings>;} |
{type: 'MARK_VIEWED';requestId: string;} |
{type: 'RECORD_USER_DECISION';userDecision: UserDecision;} |
{type: 'FOLLOW_UP_CONFIRMED';requestId: string;} |
{type: 'CONTEXT_UPDATE';requestId: string;} |
{type: 'REQUEST_CANCEL';executionId: string;userName: string;} |
{type: 'CANCEL_RESOLVED';executionId: string;delayed: boolean;} |
{type: 'CANCEL_CHECKED';executionId: string;} |
{type: 'STEERING'; executionId: string; text: string; userId: string; files?: import("../types/workbench").PrototypeFile[];} |
{type: 'RESET';};

export const defaultSettings: DemoSettings = {
  submitMode: 'normal',
  evidenceUnavailable: false,
  cancelDelayed: false,
  connectionLostAt: null,
  briefLoadFail: false,
  sessionExpired: false
};

export function createInitialState(): WorkbenchState {
  return {
    userId: 'u-zhang',
    executions: JSON.parse(JSON.stringify(seedExecutions)) as Execution[],
    requests: JSON.parse(JSON.stringify(seedRequests)) as DecisionRequest[],
    settings: { ...defaultSettings },
    viewed: {}
  };
}

function mapRequest(state: WorkbenchState, id: string, fn: (r: DecisionRequest) => DecisionRequest): WorkbenchState {
  return { ...state, requests: state.requests.map((r) => r.id === id ? fn(r) : r) };
}

function mapExecution(state: WorkbenchState, id: string, fn: (e: Execution) => Execution): WorkbenchState {
  return { ...state, executions: state.executions.map((e) => e.id === id ? fn(e) : e) };
}

function appendEvent(execution: Execution, event: Omit<ExecEvent, 'id'>): Execution {
  return { ...execution, updatedAt: event.at, lastSyncedAt: event.at, events: [...execution.events, { ...event, id: createId('evt') }] };
}

export function workbenchReducer(state: WorkbenchState, action: WorkbenchAction): WorkbenchState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, userId: action.userId };
    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'MARK_VIEWED':{
        const req = state.requests.find((r) => r.id === action.requestId);
        if (!req) return state;
        return { ...state, viewed: { ...state.viewed, [req.id]: req.version } };
      }
    case 'RECORD_USER_DECISION':{
        const { userDecision } = action;
        const req = state.requests.find((r) => r.id === userDecision.requestId);
        if (!req || req.decisionHistory?.some(d => d.idempotencyKey === userDecision.idempotencyKey) || req.userDecision?.idempotencyKey === userDecision.idempotencyKey) return state;
        const next = mapRequest(state, req.id, (r) => ({
          ...r,
          status: 'answered',
          userDecision,
          decisionHistory: [...(r.decisionHistory ?? (r.userDecision ? [r.userDecision] : [])), userDecision],
          updatedAt: userDecision.at,
          followUp: { status: 'confirming', message: '处理结果已记录；正在确认后续执行', remaining: [], updatedAt: userDecision.at }
        }));
        return mapExecution(next, req.executionId, (e) =>
        appendEvent(e, {
          at: userDecision.at,
          kind: 'human',
          title: `${userDecision.actorName} ${actionLabels[userDecision.action]}（${userDecision.channel}）`,
          detail: userDecision.choiceLabel ?? userDecision.content,
          requestId: req.id
        })
        );
      }
    case 'FOLLOW_UP_CONFIRMED':{
        const req = state.requests.find((r) => r.id === action.requestId);
        if (!req || req.followUp?.status !== 'confirming' || !req.userDecision) return state;
        const exec = state.executions.find((e) => e.id === req.executionId);
        if (!exec || (exec.cancellation && exec.cancellation.status !== 'confirmed')) return state;
        const at = nowIso();
        const userDecision = req.userDecision;
        if (userDecision.action === 'investigation') {
          const next = mapRequest(state, req.id, (r) => ({
            ...r,
            followUp: {
              status: 'recorded',
              message: '调查请求已记录，Agent 已开始补充调查。原问题是否仍需你处理，将由调查结果决定。',
              remaining: [],
              updatedAt: at
            }
          }));
          return mapExecution(next, exec.id, (e) =>
          appendEvent(
            { ...e, ended: false, cancellation: null, summary: { ...e.summary, doing: [...e.summary.doing, `补充调查：${req.waitingItem}`] } },
            { at, kind: 'agent', title: '已开始补充调查', detail: userDecision.content, requestId: req.id }
          )
          );
        }
        const remaining = state.requests.
        filter((r) => r.executionId === exec.id && r.id !== req.id && r.status === 'pending').
        map((r) => r.waitingItem);
        const next = mapRequest(state, req.id, (r) => ({
          ...r,
          followUp: { status: 'continued', message: `相关工作已继续：${req.waitingItem}`, remaining, updatedAt: at }
        }));
        return mapExecution(next, exec.id, (e) =>
        appendEvent(
          {
            ...e,
            ended: false, cancellation: null,
            summary: {
              doing: [...e.summary.doing, `继续：${req.waitingItem}`],
              waiting: e.summary.waiting.filter((w) => w !== req.waitingItem),
              canContinue: e.summary.canContinue
            }
          },
          { at, kind: 'resume', title: `相关工作已继续：${req.waitingItem}`, detail: `依据 ${req.id} 的处理结果（${userDecision.actorName}）`, requestId: req.id }
        )
        );
      }
    case 'CONTEXT_UPDATE':{
        const req = state.requests.find((r) => r.id === action.requestId);
        if (!req || req.status === 'answered') return state;
        const u = req.contextUpdate ?? {
          source: '业务系统（模拟）',
          summary: '相关业务资料已更新',
          scope: '需重新核对已知事实与证据版本',
          addFacts: [],
          addEvidenceIds: [],
          removeGaps: []
        };
        const at = nowIso();
        const version = req.version + 1;
        const next = mapRequest(state, req.id, (r) => ({
          ...r,
          version,
          updatedAt: at,
          contextUpdate: null,
          changes: [...r.changes, { version, at, source: u.source, summary: u.summary, scope: u.scope }],
          brief: {
            ...r.brief,
            facts: [...r.brief.facts, ...u.addFacts],
            evidenceIds: Array.from(new Set([...r.brief.evidenceIds, ...u.addEvidenceIds])),
            gaps: r.brief.gaps.filter((g) => !u.removeGaps.includes(g))
          }
        }));
        return mapExecution(next, req.executionId, (e) =>
        appendEvent(e, { at, kind: 'system', title: '业务资料已更新', detail: u.summary, requestId: req.id, evidenceIds: u.addEvidenceIds })
        );
      }
    case 'REQUEST_CANCEL':{
        const exec = state.executions.find((e) => e.id === action.executionId);
        if (!exec || exec.cancellation) return state;
        const at = nowIso();
        return mapExecution(state, exec.id, (e) =>
        appendEvent(
          { ...e, cancellation: { status: 'requested', requestedAt: at, requestedBy: action.userName } },
          { at, kind: 'system', title: '取消请求已接受，等待运行时确认', detail: `${action.userName} 请求取消后续执行` }
        )
        );
      }
    case 'CANCEL_RESOLVED':{
        const exec = state.executions.find((e) => e.id === action.executionId);
        if (!exec?.cancellation || exec.cancellation.status === 'confirmed') return state;
        const at = nowIso();
        if (action.delayed) {
          return mapExecution(state, exec.id, (e) => ({
            ...e,
            cancellation: {
              ...e.cancellation!,
              status: 'delayed',
              lastCheckedAt: at,
              reason: '进行中的业务调用尚未返回回执，运行时暂不能确认已停止。'
            }
          }));
        }
        return mapExecution(state, exec.id, (e) => {
          const outcome = {
            stopped: [...e.summary.doing.map((d) => `${d}（已停止）`), '尚未开始的后续工作不再开始'],
            retained: e.results.filter((r) => r.status !== 'unknown').map((r) => r.title),
            businessEffects: e.results.filter((r) => r.status === 'confirmed').map((r) => r.title),
            unverified: e.logs.filter((l) => l.receiptStatus !== 'confirmed').map((l) => `${l.tool}：${l.call}`)
          };
          return appendEvent(
            {
              ...e,
              cancellation: { ...e.cancellation!, status: 'confirmed', resolvedAt: at, lastCheckedAt: at, outcome },
              summary: { doing: [], waiting: e.summary.waiting, canContinue: [] }
            },
            { at, kind: 'receipt', title: '运行时确认：后续执行已停止', detail: '既有业务操作未被撤销' }
          );
        });
      }
    case 'CANCEL_CHECKED':
      return mapExecution(state, action.executionId, (e) =>
      e.cancellation ? { ...e, cancellation: { ...e.cancellation, lastCheckedAt: nowIso() } } : e
      );
    case 'STEERING': {
      const execution = state.executions.find(e => e.id === action.executionId);
      if (!execution || execution.ownerId !== action.userId) return state;
      return mapExecution(state, execution.id, e => appendEvent({ ...e, ended: e.cancellation && e.cancellation.status !== 'confirmed' ? e.ended : false, cancellation: e.cancellation && e.cancellation.status !== 'confirmed' ? e.cancellation : null, uploads: [...(e.uploads ?? []), ...(action.files ?? [])] }, {
        at: nowIso(), kind: 'human', title: 'Steering Input 已交付（模拟）', detail: action.text
      }));
    }
    case 'RESET':
      return createInitialState();
    default:
      return state;
  }
}
