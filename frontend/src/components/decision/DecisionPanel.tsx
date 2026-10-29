import React from 'react';
import { Alert, AlertTitle, Box, Button, Divider, Skeleton, Stack, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import type { DecisionRequest, Execution } from '../../types/workbench';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { useDecisionPanel } from '../../hooks/useDecisionPanel';
import { userName } from '../../utils/decisionService';
import { formatTime } from '../../utils/time';
import { DecisionBrief } from './DecisionBrief';
import { ResolutionForm } from './ResolutionForm';
import { ConfirmSubmission } from './ConfirmSubmission';
import { ResolutionRecord } from './ResolutionRecord';

interface DecisionPanelProps {
  request: DecisionRequest;
  execution: Execution;
  onOpenEvidence: (id: string) => void;
}

export function DecisionPanel({ request, execution, onOpenEvidence }: DecisionPanelProps) {
  const { currentUser } = useWorkbench();
  const p = useDecisionPanel(request);

  if (p.briefStatus === 'loading') {
    return (
      <Stack spacing={1.25} sx={{ p: 2 }} aria-busy="true" aria-label="正在加载 Decision Brief">
        <Skeleton width="30%" />
        <Skeleton width="85%" height={28} />
        <Skeleton variant="rectangular" height={72} />
        <Skeleton variant="rectangular" height={110} />
        <Skeleton variant="rectangular" height={80} />
      </Stack>);

  }

  if (p.briefStatus === 'error') {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error" action={<Button color="inherit" onClick={p.retryBrief}>重试</Button>}>
          <AlertTitle>Decision Brief 加载失败</AlertTitle>
          仅此区域受影响，左侧执行情况已正常加载。你的草稿（如有）仍保留。
        </Alert>
      </Box>);

  }

  if (request.status === 'resolved') {
    return (
      <Box sx={{ p: 2 }}>
        <ResolutionRecord
          request={request}
          conflictDraft={p.conflictDraft}
          justSubmitted={p.outcome?.kind === 'accepted' || p.outcome?.kind === 'duplicate'}
          onDiscardDraft={p.discard}
          onOpenEvidence={onOpenEvidence} />
        
      </Box>);

  }

  return (
    <Stack spacing={2} sx={{ p: 2 }}>
      {!p.canResolve &&
      <Alert severity="info" icon={<LockOutlinedIcon fontSize="inherit" />}>
          <AlertTitle>只读查看</AlertTitle>
          此请求归属 {userName(request.ownerId)}。你（{currentUser.name}）可以查看 Brief 与证据，但不能提交处理；Airic Work 管理员身份不能替代业务授权。
        </Alert>
      }
      {execution.cancellation &&
      <Alert severity="warning">已请求取消执行。此请求是否仍适用以服务返回为准，未自动关闭。</Alert>
      }
      {p.contextChanged &&
      <Alert severity="warning" action={<Button color="inherit" onClick={p.reviewLatest}>查看最新内容</Button>}>
          <AlertTitle>{p.draft ? '请求已变化，请重新核对' : '请求内容已更新'}</AlertTitle>
          {p.unseenChanges.map((c) =>
        <Typography key={c.version} variant="body2">
              v{c.version}（{formatTime(c.at)}）· {c.source}：{c.summary}。需要复核：{c.scope}
            </Typography>
        )}
          {p.draft &&
        <Typography variant="body2" sx={{ mt: 0.5 }}>
              你的草稿已保留供比较，但不会自动提交到更新后的请求。
            </Typography>
        }
        </Alert>
      }

      {p.step === 'edit' ?
      <>
          <DecisionBrief request={request} onOpenEvidence={onOpenEvidence} />
          {p.canResolve &&
        <>
              <Divider />
              <ResolutionForm request={request} value={p.value} errors={p.errors} showErrors={p.showErrors} onChange={p.update} />
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                {p.draft ?
            <Button color="inherit" onClick={p.discard}>
                    放弃草稿
                  </Button> :
            null}
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
                  草稿自动保存在本浏览器，不视为决定。
                </Typography>
                <Button variant="contained" onClick={p.goConfirm} disabled={p.draftStale}>
                  下一步：核对并提交
                </Button>
              </Stack>
            </>
        }
        </> :

      <ConfirmSubmission
        request={request}
        value={p.value}
        submitting={p.submitting}
        outcome={p.outcome}
        lookupMessage={p.lookupMessage}
        draftStale={p.draftStale}
        onBack={p.backToEdit}
        onSubmit={p.submit}
        onReviewLatest={p.reviewLatest}
        onCheckAcceptance={p.checkAcceptance} />

      }
    </Stack>);

}