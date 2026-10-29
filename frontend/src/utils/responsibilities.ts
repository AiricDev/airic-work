import type { WorkbenchState } from '../types/workbench';

export function responsibilitiesFor(userId: string, state: WorkbenchState) {
  const executions = state.executions.filter(
    (e) => e.ownerId === userId && !e.ended && e.cancellation?.status !== 'confirmed'
  );
  const requests = state.requests.filter((r) => r.ownerId === userId && r.status === 'pending');
  return { executions, requests, counts: { executions: executions.length, requests: requests.length } };
}