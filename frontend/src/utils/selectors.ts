import type { DecisionRequest, DemoUser, Execution, Project } from '../types/workbench';
import { projects } from '../data/projects';

export type TagIcon = 'play' | 'pause' | 'done' | 'hourglass' | 'stop';

export interface ExecutionTag {
  label: string;
  color: 'default' | 'info' | 'warning' | 'success';
  icon: TagIcon;
}

export function getVisibleProjects(user: DemoUser): Project[] {
  return projects.filter((p) => user.visibleProjectIds.includes(p.id));
}

export function getVisibleExecutions(executions: Execution[], user: DemoUser): Execution[] {
  return executions.filter((e) => e.ownerId === user.id);
}

export function getVisibleRequests(requests: DecisionRequest[], executions: Execution[], user: DemoUser): DecisionRequest[] {
  const ids = new Set(getVisibleExecutions(executions, user).map((e) => e.id));
  return requests.filter((r) => ids.has(r.executionId));
}

export function pendingFor(requests: DecisionRequest[], executionId: string): DecisionRequest[] {
  return requests.
  filter((r) => r.executionId === executionId && r.status === 'pending').
  sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function firstActionableRequest(requests: DecisionRequest[], executionId: string, user: DemoUser): DecisionRequest | undefined {
  const pending = pendingFor(requests, executionId);
  return pending.find((r) => r.ownerId === user.id) ?? pending[0];
}

export function projectById(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function projectLastActivity(project: Project, executions: Execution[]): string {
  const times = executions.filter((e) => e.projectId === project.id).map((e) => e.updatedAt);
  return [project.lastActivity, ...times].sort().slice(-1)[0];
}

export function currentWorkText(execution: Execution): string {
  if (execution.cancellation?.status === 'confirmed') return '后续执行已停止';
  if (execution.ended) return 'Agent 执行已结束';
  if (execution.summary.doing[0]) return execution.summary.doing[0];
  if (execution.summary.waiting[0]) return `等待：${execution.summary.waiting[0]}`;
  return '尚无可确认信息';
}

export function executionTag(execution: Execution, pendingCount: number): ExecutionTag {
  const c = execution.cancellation;
  if (c?.status === 'confirmed') return { label: '已停止', color: 'default', icon: 'stop' };
  if (c) return { label: '取消处理中', color: 'warning', icon: 'hourglass' };
  if (execution.ended) return { label: '执行已结束', color: 'default', icon: 'done' };
  if (pendingCount > 0) return { label: '部分等待', color: 'warning', icon: 'pause' };
  return { label: '进行中', color: 'info', icon: 'play' };
}
