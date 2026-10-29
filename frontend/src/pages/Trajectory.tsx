import React, { useMemo, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography } from
'@mui/material';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { usePlatform } from '../contexts/PlatformContext';
import type { TrajectoryType } from '../types/platform';
import { projectById } from '../utils/selectors';
import { trajectoryFor, trajectoryTypeLabels } from '../utils/trajectory';
import { formatTime } from '../utils/time';
import { TrajectoryEventDrawer } from '../components/trajectory/TrajectoryEventDrawer';
import { EvidenceDrawer } from '../components/decision/EvidenceDrawer';

const ROWS = 10;
const ranges: Record<string, number> = { all: 0, '60': 60, '180': 180 };

export function Trajectory() {
  const { executionId } = useParams();
  const [params, setParams] = useSearchParams();
  const { state, currentUser } = useWorkbench();
  const platform = usePlatform();
  const [evidenceId, setEvidenceId] = useState<string | null>(null);

  const found = state.executions.find((e) => e.id === executionId);
  const execution = found && currentUser.visibleProjectIds.includes(found.projectId) ? found : undefined;
  const { events, gapNote } = useMemo(
    () => execution ? trajectoryFor(execution, platform.state.demo.trajectoryMissing) : { events: [], gapNote: null },
    [execution, platform.state.demo.trajectoryMissing]
  );

  if (!execution) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
        <Typography variant="h6">执行不存在或你无权查看</Typography>
        <Button component={RouterLink} to="/executions" variant="outlined" sx={{ mt: 2 }}>返回全部执行</Button>
      </Paper>);

  }

  const type = params.get('type') ?? '';
  const request = params.get('request') ?? '';
  const range = params.get('range') ?? 'all';
  const page = Number(params.get('page') ?? '0') || 0;
  const eventId = params.get('event');
  const requestIds = Array.from(new Set(events.map((e) => e.requestId).filter(Boolean))) as string[];
  const filtered = events.
  filter((e) => (!type || e.type === type) && (!request || e.requestId === request) && (!ranges[range] || Date.now() - new Date(e.at).getTime() <= ranges[range] * 60000)).
  reverse();
  const pageRows = filtered.slice(page * ROWS, page * ROWS + ROWS);
  const current = events.find((e) => e.id === eventId) ?? null;
  const ci = current ? events.indexOf(current) : -1;
  const project = projectById(execution.projectId);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);else
    next.delete(k);
    if (k !== 'page' && k !== 'event') next.delete('page');
    setParams(next, { replace: k !== 'event' });
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Breadcrumbs aria-label="位置">
        <Link component={RouterLink} to="/projects" underline="hover" color="inherit">项目</Link>
        {project && <Link component={RouterLink} to={`/projects/${project.id}`} underline="hover" color="inherit">{project.name}</Link>}
        <Link component={RouterLink} to={`/executions/${execution.id}`} underline="hover" color="inherit">{execution.goal}</Link>
        <Typography color="text.primary">执行轨迹</Typography>
      </Breadcrumbs>
      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Typography variant="h6" component="h1">执行轨迹 · {execution.goal}</Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ fontFamily: 'monospace' }}>
          {execution.id} · OM {execution.omRepo} @{' '}
          <Link component={RouterLink} to={`/om?commit=${execution.omCommit}&path=root.md`}>{execution.omCommit}</Link> · {execution.runtimeVersion} · {execution.skillVersion}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          记录覆盖：{formatTime(execution.startedAt)} 至 {formatTime(execution.lastSyncedAt)}。授权证据视图，不包含隐藏思考链；原始事件只读。
        </Typography>
        {gapNote && <Alert severity="warning" sx={{ mt: 1.5 }}>轨迹不完整：{gapNote}。外部只读读取会返回同等的缺失说明。</Alert>}
      </Paper>

      <Paper variant="outlined">
        <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="t-type">事件类型</InputLabel>
            <Select labelId="t-type" label="事件类型" value={type} onChange={(e) => setParam('type', e.target.value)}>
              <MenuItem value="">全部</MenuItem>
              {(Object.keys(trajectoryTypeLabels) as TrajectoryType[]).map((t) => <MenuItem key={t} value={t}>{trajectoryTypeLabels[t]}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="t-req">关联请求</InputLabel>
            <Select labelId="t-req" label="关联请求" value={request} onChange={(e) => setParam('request', e.target.value)}>
              <MenuItem value="">全部</MenuItem>
              {requestIds.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="t-range">时间范围</InputLabel>
            <Select labelId="t-range" label="时间范围" value={range} onChange={(e) => setParam('range', e.target.value === 'all' ? '' : e.target.value)}>
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="60">最近 1 小时</MenuItem>
              <MenuItem value="180">最近 3 小时</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>类型</TableCell>
                <TableCell sx={{ minWidth: 280 }}>摘要</TableCell>
                <TableCell>关联请求</TableCell>
                <TableCell>确认程度</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.map((e) => {
                const hidden = e.sensitivity === 'purged' || e.sensitivity === 'restricted';
                return (
                  <TableRow key={e.id} hover selected={e.id === eventId} sx={{ cursor: 'pointer' }} onClick={() => setParam('event', e.id)}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(e.at)}</TableCell>
                    <TableCell><Chip variant="outlined" label={trajectoryTypeLabels[e.type]} /></TableCell>
                    <TableCell sx={{ color: hidden ? 'text.disabled' : undefined }}>
                      {e.sensitivity === 'restricted' ? '受限记录（无权查看内容）' : e.summary}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{e.requestId ?? '—'}</TableCell>
                    <TableCell>
                      <Chip variant="outlined" color={e.confirmation === '权威回执' ? 'success' : e.confirmation === '未确认' ? 'warning' : 'default'} label={e.confirmation} />
                    </TableCell>
                  </TableRow>);

              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>没有符合条件的事件。</Typography>}
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          rowsPerPage={ROWS}
          rowsPerPageOptions={[ROWS]}
          onPageChange={(_, p) => setParam('page', p ? String(p) : '')}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 共 ${count} 条`} />
        
      </Paper>

      <TrajectoryEventDrawer
        event={current}
        prev={ci > 0 ? events[ci - 1] : undefined}
        next={ci >= 0 && ci < events.length - 1 ? events[ci + 1] : undefined}
        execution={execution}
        onNavigate={(id) => setParam('event', id)}
        onOpenEvidence={setEvidenceId}
        onClose={() => setParam('event', '')} />
      
      <EvidenceDrawer evidenceId={evidenceId} onClose={() => setEvidenceId(null)} />
    </Box>);

}