import CloseIcon from '@mui/icons-material/Close';
import { Alert,Box,Button,Chip,Divider,Drawer,IconButton,Link,Stack,Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { TrajectoryEvent } from '../../types/platform';
import type { Execution } from '../../types/workbench';
import { userName } from '../../utils/decisionService';
import { formatTime } from '../../utils/time';
import { trajectoryTypeLabels } from '../../utils/trajectory';
const evidence: import('../../types/workbench').Evidence[] = [];
const executionOrigins: import('../../types/platform').ExecutionOrigin[] = [];

interface TrajectoryEventDrawerProps {
  event: TrajectoryEvent | null;
  prev?: TrajectoryEvent;
  next?: TrajectoryEvent;
  execution: Execution;
  onNavigate: (id: string) => void;
  onOpenEvidence: (id: string) => void;
  onClose: () => void;
}

const sensitivityNote = {
  redacted: '部分字段已按敏感字段策略脱敏，仅显示存在性。',
  purged: '该记录已按保留政策清理，仅保留占位。',
  restricted: '你无权查看此记录内容。'
} as const;

export function TrajectoryEventDrawer({ event, prev, next, execution, onNavigate, onOpenEvidence, onClose }: TrajectoryEventDrawerProps) {
  const hidden = event && (event.sensitivity === 'purged' || event.sensitivity === 'restricted');
  const origin = executionOrigins.find((o) => o.executionId === execution.id);

  return (
    <Drawer anchor="right" open={Boolean(event)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 560 } } }}>
      {event &&
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack direction="row" alignItems="flex-start" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{event.id} · {formatTime(event.at)}</Typography>
              <Typography variant="subtitle1" component="h2">{hidden ? '内容不可见' : event.summary}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                <Chip variant="outlined" label={trajectoryTypeLabels[event.type]} />
                <Chip variant="outlined" color={event.confirmation === '权威回执' ? 'success' : event.confirmation === '未确认' ? 'warning' : 'default'} label={event.confirmation} />
              </Stack>
            </Box>
            <IconButton aria-label="关闭事件详情" onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          <Stack spacing={2} sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            {event.sensitivity !== 'normal' && <Alert severity={event.sensitivity === 'restricted' ? 'error' : 'info'}>{sensitivityNote[event.sensitivity]}</Alert>}
            {!hidden &&
          <>
                <Box>
                  <Typography variant="overline" color="text.secondary">输入（可见部分）</Typography>
                  <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{event.input ?? '—'}</Box>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">输出 / 回执</Typography>
                  <Box sx={{ p: 1.25, bgcolor: 'action.hover', borderRadius: 1, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>{event.output ?? '—'}</Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {event.confirmation === '权威回执' ? '此事件有业务系统或平台的权威回执。' : '此事件记录的是动作发起或 Agent 描述，不是权威回执，不应视为已生效。'}
                </Typography>
              </>
          }
            <Divider />
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, '& dd': { m: 0 } }}>
              <Typography component="dt" variant="body2" color="text.secondary">业务主体</Typography>
              <Typography component="dd" variant="body2">{userName(execution.ownerId)}（{execution.source.system}）</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">技术执行者</Typography>
              <Typography component="dd" variant="body2">{origin?.technicalExecutor ?? '未知'}</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">OM 版本</Typography>
              <Typography component="dd" variant="body2">
                <Link component={RouterLink} to={`/om?commit=${execution.omCommit}&executionId=${execution.id}`} sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {execution.omCommit}
                </Link>
              </Typography>
            </Box>
            <Stack spacing={0.75}>
              {event.requestId &&
            <Link component={RouterLink} to={`/executions/${execution.id}?request=${event.requestId}`}>关联请求 {event.requestId}</Link>
            }
              {event.episodeId && <Link component={RouterLink} to={`/episodes/${event.episodeId}`}>Decision Episode {event.episodeId}</Link>}
              {event.evidenceIds?.map((id) => {
              const d = evidence.find((x) => x.id === id);
              return d ?
              <Link key={id} component="button" onClick={() => onOpenEvidence(id)} sx={{ textAlign: 'left' }}>
                    Context 来源 {d.title} · {d.objectId} {d.version}
                  </Link> :
              null;
            })}
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button disabled={!prev} onClick={() => prev && onNavigate(prev.id)}>上一条</Button>
            <Button disabled={!next} onClick={() => next && onNavigate(next.id)}>下一条</Button>
          </Stack>
        </Box>
      }
    </Drawer>);

}
