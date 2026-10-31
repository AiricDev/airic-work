import type { ContextDependency,Delegation } from '../types/platform';
import type { DecisionRequest } from '../types/workbench';
const contextDependencies: import('../types/platform').ContextDependency[] = [];

/** Effective dependency list for a request, reflecting context updates and current delegation validity. */
export function dependenciesFor(request: DecisionRequest, delegations: Delegation[]): ContextDependency[] {
  return contextDependencies.
  filter((d) => d.requestId === request.id).
  map((d) => {
    let dep: ContextDependency = d;
    if (d.afterUpdate && request.version > 1) {
      dep = { ...d, status: d.afterUpdate.status, note: d.afterUpdate.note, evidenceId: d.afterUpdate.evidenceId ?? d.evidenceId, version: d.afterUpdate.version ?? d.version };
    }
    if (d.kind === '授权' && d.delegationSystem) {
      const dg = delegations.find((x) => x.userId === request.ownerId && x.system === d.delegationSystem);
      if (!dg || dg.status !== '有效') {
        dep = { ...dep, status: '过期', note: `当前委托状态：${dg?.status ?? '未授权'}。需归属人本人重新授权。` };
      }
    }
    return dep;
  });
}

export const dependencyStatusColor: Record<ContextDependency['status'], 'success' | 'warning' | 'error' | 'info' | 'default'> = {
  就绪: 'success',
  缺失: 'warning',
  待核实: 'info',
  过期: 'error',
  无访问权: 'default'
};
