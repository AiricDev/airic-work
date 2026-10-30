import { Link as RouterLink, useParams } from 'react-router-dom';
import { Alert, Box, Link, Paper, Stack, Typography } from '@mui/material';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { episodes } from '../data/episodes';
export function EpisodeDetail() {
  const { episodeId } = useParams();
  const { state, currentUser } = useWorkbench();
  const requestId = episodes.find(e => e.id === episodeId)?.requestId ?? episodeId?.replace(/^EP-/, 'DR-');
  const request = state.requests.find(r => r.id === requestId);
  const execution = state.executions.find(e => e.id === request?.executionId && e.ownerId === currentUser.id);
  if (!request || !execution) return <Alert severity="warning">Decision Episode 不存在或无权查看。</Alert>;
  return <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
    <Typography variant="h5">Decision Episode · {request.id}</Typography><Typography>{request.question}</Typography>
    <Alert severity="info">一个 DecisionRequest 的生命周期，与请求一一对应；不是独立的学习结论或 Precedent。</Alert>
    <Typography>创建：{request.createdAt}</Typography><Typography>状态：{request.status === 'answered' ? '已回答' : '待回答'}</Typography>
    <Typography>Decision Context：v{request.version} · OM：{execution.omCommit}</Typography>
    {request.userDecision && <Box><Typography>UserDecision：{request.userDecision.actorName} · {request.userDecision.at}</Typography><Typography>{request.userDecision.content}</Typography><Typography>{request.followUp?.message}</Typography></Box>}
    {request.decisionHistory?.map(d => <Typography key={d.id}>UserDecision 历史：{d.at} · {d.content}</Typography>)}
    <Link component={RouterLink} to={`/executions/${execution.id}?request=${request.id}`}>查看 Decision Brief 与 UserDecision</Link>
    <Link component={RouterLink} to={`/executions/${execution.id}/trajectory?request=${request.id}`}>定位 Session</Link>
  </Stack></Paper>;
}
