import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Alert,AlertTitle,Box,Button,LinearProgress,Link,Stack,Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { DecisionRequest,Execution } from '../../types/workbench';
import { formatTime } from '../../utils/time';

interface ExecutionSituationProps {
  execution: Execution;
  pendingRequests: DecisionRequest[];
  onOpenRequest: (requestId: string) => void;
  onQueryCancel: () => void;
}

export function ExecutionSituation({ execution, pendingRequests, onOpenRequest, onQueryCancel }: ExecutionSituationProps) {
  const { summary, cancellation } = execution;
  const lastEvent = execution.events[execution.events.length - 1];
  const columns = [
  { key: 'doing', title: '正在做', icon: <PlayArrowIcon fontSize="small" color="primary" />, items: summary.doing },
  { key: 'waiting', title: '等待人工', icon: <PauseCircleOutlineIcon fontSize="small" color="warning" />, items: pendingRequests.map(r=>r.question) },
  { key: 'continue', title: '可继续', icon: <ArrowForwardIcon fontSize="small" color="success" />, items: summary.canContinue }];


  return (
    <Stack spacing={1.5}>
      {cancellation?.status === 'requested' &&
      <Alert severity="info">
          <AlertTitle>取消请求已接受，等待确认</AlertTitle>
          尚不能确认执行已停止。运行时返回结果后会在此显示实际情况。
          <LinearProgress sx={{ mt: 1 }} aria-label="等待运行时确认" />
        </Alert>
      }
      {cancellation?.status === 'delayed' &&
      <Alert
        severity="warning"
        action={
        <Button color="inherit" onClick={onQueryCancel}>
              查询取消状态
            </Button>
        }>

          <AlertTitle>取消尚未完成</AlertTitle>
          {cancellation.reason} 最近查询：{cancellation.lastCheckedAt ? formatTime(cancellation.lastCheckedAt) : '—'}。无需重复发起取消请求。
        </Alert>
      }
      {cancellation?.status === 'confirmed' && cancellation.outcome &&
      <Alert severity="info" icon={false} sx={{ '& .MuiAlert-message': { width: '100%' } }}>
          <AlertTitle>后续执行已停止（{cancellation.resolvedAt ? formatTime(cancellation.resolvedAt) : ''} 确认）</AlertTitle>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 1 }}>
            <OutcomeList title="实际停止" items={cancellation.outcome.stopped} />
            <OutcomeList title="保留的产物" items={cancellation.outcome.retained} />
            <OutcomeList title="已有业务效果（未撤销）" items={cancellation.outcome.businessEffects} />
            <OutcomeList title="仍需核实的调用" items={cancellation.outcome.unverified} />
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            待决事项是否仍适用以服务返回为准，未自动关闭。
          </Typography>
        </Alert>
      }
      {execution.phase==='new' && <Alert severity="info">执行已创建，尚待运行宿主准备与派发。</Alert>}
      {execution.phase==='failed' && <Alert severity="error">执行失败，请查看 Session 中的实际记录。</Alert>}
      {execution.ended &&
      <Alert severity="info">
          <AlertTitle>Agent 执行已结束</AlertTitle>
          业务完成状态请以业务系统为准。{' '}
          <Link component={RouterLink} to={`/business?ref=${execution.source.ref}`}>
            在业务系统查看
          </Link>
        </Alert>
      }
      {lastEvent?.kind === 'resume' &&
      <Alert severity="success">
          {lastEvent.title}（{formatTime(lastEvent.at)}，已取得执行事件）
        </Alert>
      }

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>
        {columns.map((col) =>
        <Box key={col.key} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75 }}>
              {col.icon}
              <Typography variant="subtitle2" component="h3">
                {col.title}
              </Typography>
            </Stack>
            {col.items.length === 0 ?
          <Typography variant="body2" color="text.secondary">
                尚无可确认信息
              </Typography> :

          <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 2 }}>
                {col.items.map((item) => {
              const req = col.key === 'waiting' ? pendingRequests.find((r) => r.waitingItem === item) : undefined;
              return (
                <Typography component="li" variant="body2" key={item}>
                      {item}
                      {req &&
                  <>
                          {' '}
                          <Link component="button" variant="body2" onClick={() => onOpenRequest(req.id)} sx={{ verticalAlign: 'baseline' }}>
                            查看请求
                          </Link>
                        </>
                  }
                    </Typography>);

            })}
              </Stack>
          }
          </Box>
        )}
      </Box>
    </Stack>);

}

function OutcomeList({ title, items }: {title: string;items: string[];}) {
  return (
    <Box>
      <Typography variant="subtitle2">{title}</Typography>
      {items.length === 0 ?
      <Typography variant="body2" color="text.secondary">
          无
        </Typography> :

      <Box component="ul" sx={{ m: 0, pl: 2 }}>
          {items.map((i) =>
        <Typography component="li" variant="body2" key={i}>
              {i}
            </Typography>
        )}
        </Box>
      }
    </Box>);

}
