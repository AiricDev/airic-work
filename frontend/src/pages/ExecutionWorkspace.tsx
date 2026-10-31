import {
Alert,
Box,
Button,
Dialog,
DialogActions,
DialogContent,
DialogContentText,
DialogTitle,
Paper,
Skeleton,
Stack,
Tab,
Tabs,
Typography,
useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useState } from 'react';
import { Link as RouterLink,useParams } from 'react-router-dom';
import { DecisionColumn } from '../components/decision/DecisionColumn';
import { EvidenceDrawer } from '../components/decision/EvidenceDrawer';
import { AskExecutionPanel } from '../components/execution/AskExecutionPanel';
import { CancelExecutionDialog } from '../components/execution/CancelExecutionDialog';
import { ExecutionActivityTabs } from '../components/execution/ExecutionActivityTabs';
import { ExecutionConnections } from '../components/execution/ExecutionConnections';
import { ExecutionHeader } from '../components/execution/ExecutionHeader';
import { ExecutionSituation } from '../components/execution/ExecutionSituation';
import { useExecutionWorkspace } from '../hooks/useExecutionWorkspace';
import { formatTime } from '../utils/time';

export function ExecutionWorkspace() {
  const { executionId } = useParams();
  const w = useExecutionWorkspace(executionId);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [mobileTab, setMobileTab] = useState<'execution' | 'decisions'>(w.activeRequest ? 'decisions' : 'execution');

  if (!w.execution) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
        <Typography variant="h6">执行不存在或你无权查看</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          可见范围由授权决定，此处不显示不可见对象的任何信息。
        </Typography>
        <Button component={RouterLink} to="/projects" sx={{ mt: 2 }} variant="outlined">
          返回项目列表
        </Button>
      </Paper>);

  }

  const execution = w.execution;

  const openRequest = (id: string) => {
    w.selectRequest(id);
    setMobileTab('decisions');
  };

  const left = w.loading ?
  <Stack spacing={1.5} sx={{ p: 2 }} aria-busy="true">
      <Skeleton variant="rectangular" height={110} />
      <Skeleton width="40%" />
      <Skeleton variant="rectangular" height={220} />
    </Stack> :

  <Stack spacing={2} sx={{ p: 2 }}>
      <Box>
        <Typography variant="subtitle1" component="h2" sx={{ mb: 1 }}>
          执行情况
        </Typography>
        <ExecutionSituation execution={execution} pendingRequests={w.pending} onOpenRequest={openRequest} onQueryCancel={w.queryCancel} />
      </Box>
      <ExecutionActivityTabs execution={execution} onOpenEvidence={w.setEvidenceId} onOpenRequest={openRequest} />
      <ExecutionConnections executionId={execution.id} />
      <AskExecutionPanel key={execution.id} execution={execution} requests={w.requests} onLocateRequest={openRequest} />
    </Stack>;


  const right = w.loading ?
  <Stack spacing={1.5} sx={{ p: 2 }} aria-busy="true">
      <Skeleton width="50%" height={28} />
      <Skeleton variant="rectangular" height={64} />
      <Skeleton variant="rectangular" height={260} />
    </Stack> :

  <DecisionColumn
    execution={execution}
    requests={w.requests}
    activeRequest={w.activeRequest}
    missingRequest={w.missingRequest}
    onSelect={w.selectRequest}
    onOpenEvidence={w.setEvidenceId} />;



  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: { md: 'calc(100vh - 112px)' } }}>
      {w.cancelError && <Alert severity="error">{w.cancelError}</Alert>}
      <ExecutionHeader
        execution={execution}
        project={w.project}
        from={w.from}
        pendingCount={w.pending.length}
        cancelDisabledReason={w.cancelDisabledReason}
        onRequestCancel={() => w.setCancelOpen(true)} />


      {w.connectionLostAt &&
      <Alert severity="warning" sx={{ flexShrink: 0 }}>
          连接中断，信息截至 {formatTime(w.connectionLostAt)}。以下为缓存内容，不代表实时状态。
        </Alert>
      }

      {isDesktop ?
      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(0, 7fr) minmax(0, 5fr)', gap: 1.5 }}>
          <Paper variant="outlined" component="section" aria-label="执行区" sx={{ overflow: 'auto' }}>
            {left}
          </Paper>
          <Paper variant="outlined" component="section" aria-label="待决事项" sx={{ overflow: 'auto' }}>
            {right}
          </Paper>
        </Box> :

      <Paper variant="outlined">
          <Tabs value={mobileTab} onChange={(_, v: 'execution' | 'decisions') => setMobileTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tab value="execution" label="执行" />
            <Tab value="decisions" label={`待决 (${w.pending.length})`} />
          </Tabs>
          {mobileTab === 'execution' ? left : right}
        </Paper>
      }

      <EvidenceDrawer evidenceId={w.evidenceId} onClose={() => w.setEvidenceId(null)} />
      <CancelExecutionDialog open={w.cancelOpen} execution={execution} onClose={() => w.setCancelOpen(false)} onConfirm={w.confirmCancel} />

      <Dialog open={w.blocker.state === 'blocked'} onClose={() => w.blocker.reset?.()} aria-labelledby="draft-guard-title">
        <DialogTitle id="draft-guard-title">有未提交的处理内容</DialogTitle>
        <DialogContent>
          <DialogContentText>
            草稿不视为决定。保留后可稍后回到此请求继续；放弃将清除该请求的草稿。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => w.blocker.reset?.()}>继续编辑</Button>
          <Button color="error" disabled={w.pendingSubmission} onClick={w.discardAndProceed}>
            放弃草稿
          </Button>
          <Button variant="contained" onClick={() => w.blocker.proceed?.()}>
            保留草稿并离开
          </Button>
        </DialogActions>
      </Dialog>
    </Box>);

}
