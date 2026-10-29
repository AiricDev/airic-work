import type { Execution } from '../types/workbench';
import type { McpResource } from '../types/platform';
import { episodes } from '../data/episodes';
import { trajectoryFor, trajectoryTypeLabels } from './trajectory';

export interface McpPayload {
  items: string[];
  notes: string[];
  total?: number;
}

/** Builds the fictional payload an external read-only MCP client would receive after authorization passes. */
export function buildMcpPayload(resource: McpResource, execution: Execution, page: number, pageSize: number, hideGap: boolean): McpPayload {
  if (resource === '执行记录索引') {
    return {
      items: [`${execution.id} · ${execution.goal} · OM @ ${execution.omCommit} · ${execution.ended ? 'Agent 执行已结束' : '进行中'}`],
      notes: ['仅包含授权 Project 内的执行；业务完成状态以业务系统为准。']
    };
  }
  if (resource === 'Trajectory 分页') {
    const { events, gapNote } = trajectoryFor(execution, hideGap);
    const slice = events.slice(page * pageSize, page * pageSize + pageSize);
    return {
      total: events.length,
      items: slice.map((e) => {
        if (e.sensitivity === 'restricted') return `${e.id} · [受限记录：仅返回存在性]`;
        if (e.sensitivity === 'purged') return `${e.id} · [已按保留政策清理]`;
        const body = e.sensitivity === 'redacted' ? `${e.summary}（敏感字段已脱敏）` : e.summary;
        return `${e.id} · ${trajectoryTypeLabels[e.type]} · ${e.confirmation} · ${body}`;
      }),
      notes: [gapNote ? `记录缺失：${gapNote}` : '本页范围内无已知缺失。', '不包含隐藏思考链、令牌或业务原文。']
    };
  }
  if (resource === 'Decision Episode') {
    const eps = episodes.filter((e) => e.executionId === execution.id);
    if (eps.length === 0) return { items: [], notes: ['该执行没有已记录的 Decision Episode。'] };
    return {
      items: eps.map((e) => `${e.id} · ${e.question} · 结论：${e.conclusion} · 文件 ${e.omPath} @ ${e.omSha.slice(0, 12)}`),
      notes: [...eps.flatMap((e) => e.limits.map((l) => `证据限制：${l}`)), 'Episode 不是正式 Precedent，也不是学习结论。']
    };
  }
  return {
    items: [`OM ${execution.omRepo} @ ${execution.omCommit}`, `Runtime ${execution.runtimeVersion}`, `Skill ${execution.skillVersion}`, `业务来源 ${execution.source.system} ${execution.source.ref}`],
    notes: ['引用本身不赋予读取业务原文的权限。']
  };
}