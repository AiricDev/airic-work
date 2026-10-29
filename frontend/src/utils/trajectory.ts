import type { Execution, EventKind } from '../types/workbench';
import type { Confirmation, TrajectoryEvent, TrajectoryType } from '../types/platform';
import { trajectoryCoverage, trajectoryEvents } from '../data/trajectory';

const kindMap: Record<EventKind, {type: TrajectoryType;confirmation: Confirmation;}> = {
  system: { type: 'system', confirmation: '权威回执' },
  receipt: { type: 'receipt', confirmation: '权威回执' },
  agent: { type: 'action', confirmation: 'Agent 描述' },
  request: { type: 'request', confirmation: '权威回执' },
  human: { type: 'intervention', confirmation: '人工记录' },
  resume: { type: 'action', confirmation: 'Agent 描述' }
};

export const trajectoryTypeLabels: Record<TrajectoryType, string> = {
  action: '动作',
  observation: '观察',
  receipt: '回执',
  intervention: '人工干预',
  request: '待决事项',
  system: '系统'
};

export function trajectoryFor(execution: Execution, hideGap: boolean): {events: TrajectoryEvent[];gapNote: string | null;} {
  const base = trajectoryEvents.filter((e) => e.executionId === execution.id);
  const lastBase = base.length ? base[base.length - 1].at : '';
  const live: TrajectoryEvent[] = execution.events.
  filter((e) => !base.length || e.at > lastBase).
  map((e) => ({
    id: `L-${e.id}`,
    executionId: execution.id,
    at: e.at,
    type: kindMap[e.kind].type,
    confirmation: kindMap[e.kind].confirmation,
    summary: e.detail ? `${e.title}：${e.detail}` : e.title,
    sensitivity: 'normal',
    evidenceIds: e.evidenceIds
  }));
  let events = [...base, ...live].sort((a, b) => a.at.localeCompare(b.at));
  const cov = trajectoryCoverage.find((c) => c.executionId === execution.id);
  if (hideGap && cov) {
    const from = Date.now() - cov.gapFromMinutesAgo * 60000;
    const to = Date.now() - cov.gapToMinutesAgo * 60000;
    events = events.filter((e) => {
      const t = new Date(e.at).getTime();
      return t < from || t > to;
    });
    return { events, gapNote: cov.gapNote };
  }
  return { events, gapNote: null };
}