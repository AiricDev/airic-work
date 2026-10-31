import { useCallback,useEffect,useState } from 'react';
import { useBlocker,useLocation,useSearchParams,type BlockerFunction } from 'react-router-dom';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { draftHasContent } from '../utils/decisionService';
import { projectById } from '../utils/selectors';

export function useExecutionWorkspace(executionId: string | undefined) {
  const { state, projects, drafts, currentUser, requestCancel, queryCancel, discardDraft } = useWorkbench();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const from = (location.state as {from?: string;} | null)?.from;
  const [cancelError, setCancelError] = useState('');
  const {loading} = useWorkbench();
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const found = state.executions.find((e) => e.id === executionId);
  const execution = found && found.ownerId === currentUser.id ? found : undefined;
  const project = execution ? projectById(execution.projectId, projects) : undefined;
  const requests = state.requests.
  filter((r) => r.executionId === executionId).
  sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pending = requests.filter((r) => r.status === 'pending');

  const paramRequest = params.get('request');
  const requested = paramRequest ? requests.find((r) => r.id === paramRequest) : undefined;
  const missingRequest = Boolean(paramRequest && !requested);
  const activeRequest = requested ?? pending.find((r) => r.ownerId === currentUser.id) ?? pending[0] ?? null;
  const activeId = activeRequest?.id ?? null;

  // Pin the default selection in the URL so a processed request stays in view instead of jumping to the next one.
  useEffect(() => {
    if (!paramRequest && activeId) {
      const next = new URLSearchParams(params);
      next.set('request', activeId);
      setParams(next, { replace: true, state: location.state });
    }
  }, [paramRequest, activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const draft = activeId ? drafts[activeId] : undefined;
  const dirty = Boolean(activeRequest && draft && draftHasContent(draft));

  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) => {
        if (!dirty || !activeId) return false;
        if (currentLocation.pathname !== nextLocation.pathname) return true;
        const nextReq = new URLSearchParams(nextLocation.search).get('request');
        return nextReq !== null && nextReq !== activeId;
      },
      [dirty, activeId]
    )
  );

  const selectRequest = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('request', id);
    setParams(next, { state: location.state });
  };

  const discardAndProceed = () => {
    if (activeId && !draft?.pending) discardDraft(activeId);
    blocker.proceed?.();
  };

  const cancelDisabledReason = !execution ?
  null :
  execution.ended ?
  'Agent 执行已结束' :
  execution.cancellation ?
  '已提交取消请求，请查看取消状态' :
  !currentUser.canRequestCancel ?
  '当前身份没有请求取消的权限' :
  null;

  return {
    execution,
    project,
    from,
    loading,
    requests,
    pending,
    activeRequest,
    missingRequest,
    selectRequest,
    evidenceId,
    setEvidenceId,
    cancelOpen,
    setCancelOpen,
    cancelDisabledReason,
    confirmCancel: async () => {
      if (!execution) return;
      try { await requestCancel(execution.id); setCancelOpen(false); setCancelError(''); } catch(e) { setCancelError(e instanceof Error?e.message:'请求失败'); }
    },
    cancelError,
    queryCancel: () => void queryCancel(),
    blocker,
    discardAndProceed,
    pendingSubmission:!!draft?.pending,
    connectionLostAt: state.settings.connectionLostAt
  };
}
