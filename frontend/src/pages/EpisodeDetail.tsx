import React, { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography } from
'@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { episodes } from '../data/episodes';
import { evidence } from '../data/evidence';
import { trajectoryEvents } from '../data/trajectory';
import { omFileLink, shortSha } from '../utils/omRepository';
import { formatTime } from '../utils/time';
import { EvidenceDrawer } from '../components/decision/EvidenceDrawer';

export function EpisodeDetail() {
  const { episodeId } = useParams();
  const { state, currentUser } = useWorkbench();
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const [refOpen, setRefOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ep = episodes.find((e) => e.id === episodeId);
  const execution = ep ? state.executions.find((e) => e.id === ep.executionId && currentUser.visibleProjectIds.includes(e.projectId)) : undefined;

  if (!ep || !execution) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
        <Typography variant="h6">判断片段不存在或你无权查看</Typography>
        <Button component={RouterLink} to="/executions" variant="outlined" sx={{ mt: 2 }}>返回全部执行</Button>
      </Paper>);

  }

  const events = trajectoryEvents.filter((e) => ep.eventIds.includes(e.id));
  const stableRef = `airic-work://episodes/${ep.id}`;

  const block = (title: string, children: React.ReactNode) =>
  <Box component="section">
      <Typography variant="subtitle1" component="h2" sx={{ mb: 0.5 }}>{title}</Typography>
      {children}
    </Box>;


  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Breadcrumbs aria-label="位置">
        <Link component={RouterLink} to={`/executions/${execution.id}`} underline="hover" color="inherit">{execution.goal}</Link>
        <Link component={RouterLink} to={`/executions/${execution.id}/trajectory`} underline="hover" color="inherit">执行轨迹</Link>
        <Typography color="text.primary">{ep.id}</Typography>
      </Breadcrumbs>
      <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h1">Decision Episode · {ep.title}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {ep.id} · 请求 {ep.requestId} · OM @ {shortSha(ep.omSha)}
            </Typography>
          </Box>
          <Button variant="outlined" onClick={() => setRefOpen(true)}>预览外部只读引用</Button>
        </Stack>
        <Alert severity="info" sx={{ mt: 1.5 }}>
          Episode 是一次实际判断的证据片段，不是学习结论或正式 Precedent；原始轨迹只读。平台不在此开展分析或采纳。
        </Alert>

        <Stack spacing={2.5} sx={{ mt: 2 }}>
          {block('问题', <Typography variant="body2">{ep.question}</Typography>)}
          {block('当时的 Context 依赖',
          <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead><TableRow><TableCell>信息</TableCell><TableCell>来源</TableCell><TableCell>当时状态</TableCell></TableRow></TableHead>
                <TableBody>
                  {ep.context.map((c) =>
                <TableRow key={c.name}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell>{c.source}</TableCell>
                      <TableCell><Chip variant="outlined" label={c.status} color={c.status === '就绪' ? 'success' : c.status === '缺失' ? 'warning' : 'info'} sx={{ height: 22 }} /></TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>
            </Box>
          )}
          {block('所用文件修订',
          <Typography variant="body2">
              <Link component={RouterLink} to={omFileLink(ep.omSha, ep.omPath)} sx={{ fontFamily: 'monospace' }}>{ep.omPath}</Link>
              {' @ '}
              <Box component="span" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{ep.omSha}</Box>
            </Typography>
          )}
          {block('结论', <Typography variant="body2">{ep.conclusion}</Typography>)}
          {block('人工干预', <Typography variant="body2">{ep.intervention}</Typography>)}
          {block('后续结果', <Typography variant="body2">{ep.followUp}</Typography>)}
          {block('证据',
          <Stack spacing={0.5} alignItems="flex-start">
              {ep.evidenceIds.map((id) => {
              const d = evidence.find((x) => x.id === id);
              return d ? <Link key={id} component="button" onClick={() => setEvidenceId(id)}>{d.title} · {d.objectId} {d.version}</Link> : null;
            })}
            </Stack>
          )}
          {block('关联轨迹事件',
          <Stack spacing={0.5}>
              {events.map((e) =>
            <Link key={e.id} component={RouterLink} to={`/executions/${execution.id}/trajectory?event=${e.id}`}>
                  {formatTime(e.at)} · {e.summary}
                </Link>
            )}
            </Stack>
          )}
          {block('证据限制',
          <Alert severity="warning">
              {ep.limits.map((l) => <Typography variant="body2" key={l}>· {l}</Typography>)}
            </Alert>
          )}
        </Stack>
      </Paper>
      <EvidenceDrawer evidenceId={evidenceId} onClose={() => setEvidenceId(null)} />

      <Dialog open={refOpen} onClose={() => setRefOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>外部只读引用预览</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{stableRef}</Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => {void navigator.clipboard?.writeText(stableRef);setCopied(true);}}>复制</Button>
            </Stack>
            <Typography variant="subtitle2">经授权读取时将交付</Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <Typography component="li" variant="body2">问题、当时的 Context 依赖名称与来源引用、结论、人工干预与后续结果</Typography>
              <Typography component="li" variant="body2">所用文件路径与完整 SHA、关联轨迹事件 ID</Typography>
              <Typography component="li" variant="body2">{ep.limits.length} 条证据限制说明</Typography>
            </Box>
            <Typography variant="subtitle2">不会交付</Typography>
            <Typography variant="body2" color="text.secondary">业务原文、令牌、隐藏思考链、受限或已清理记录的内容。引用本身不赋予读取权限。</Typography>
            <Alert severity="info">读取需要你本人授权的外部客户端，每次调用校验授权与数据策略并写入审计。</Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button component={RouterLink} to="/guide#mcp">打开只读读取演示</Button>
          <Button onClick={() => setRefOpen(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message="已复制" />
    </Box>);

}