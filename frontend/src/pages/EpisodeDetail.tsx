import { DecisionMarkdown } from '../components/shared/DecisionMarkdown';
import { decisionSummary } from '../utils/decisionSummary';
import { Alert,Box,Link,Paper,Stack,Typography } from '@mui/material';
import { Link as RouterLink,useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useApiQuery } from '../api/useApiQuery';
import { useWorkbench } from '../contexts/WorkbenchContext';

export function EpisodeDetail() {
  const { episodeId } = useParams();
  const { state, currentUser } = useWorkbench();
  const detail = useApiQuery(['episode',episodeId],()=>api('episode',{params:{id:episodeId!}}),!!episodeId);
  const requestId = episodeId;
  const request = state.requests.find(r => r.id === requestId);
  const execution = state.executions.find(e => e.id === request?.executionId && e.ownerId === currentUser.id);
  if (!request || !execution) return <Alert severity="warning">Decision Episode 不存在或无权查看。</Alert>;
  return <Paper variant="outlined" sx={{ p: 3 }}><Stack spacing={2}>
    <Typography variant="h5">Decision Episode · {request.id}</Typography><Typography variant="h6">{decisionSummary(request)}</Typography><DecisionMarkdown>{request.question}</DecisionMarkdown>
    <Alert severity="info">一个 DecisionRequest 的生命周期，与请求一一对应；不是独立的学习结论或 Precedent。</Alert>
    <Typography>创建：{request.createdAt}</Typography><Typography>状态：{request.status === 'answered' ? '已回答' : '待回答'}</Typography>
    {detail.error && <Alert severity="error">{detail.error}</Alert>}
    {detail.data?.inputs.map(i=><Typography key={i.id}>消息 {i.id}：{i.status==='delivered'?'后台已接收':'尚待交付'}</Typography>)}
    <Typography>Decision Context：v{request.version} · OM：{execution.omCommit}</Typography>
    {request.userDecision && <Box><Typography>UserDecision：{request.userDecision.actorName} · {request.userDecision.at}</Typography><Typography>{request.userDecision.content}</Typography><Typography>{request.followUp?.message}</Typography></Box>}
    {request.decisionHistory?.map(d => <Typography key={d.id}>UserDecision 历史：{d.at} · {[d.choiceLabel,d.content].filter(Boolean).join(' · ')}</Typography>)}
    <Link component={RouterLink} to={`/executions/${execution.id}?request=${request.id}`}>查看 Decision Brief 与 UserDecision</Link>
    <Link component={RouterLink} to={`/executions/${execution.id}/trajectory?request=${request.id}`}>定位 Session</Link>
  </Stack></Paper>;
}
