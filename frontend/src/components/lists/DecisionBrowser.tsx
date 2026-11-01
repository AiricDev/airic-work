import { decisionSummary } from '../../utils/decisionSummary';
import {
Box,
Chip,
FormControl,
FormControlLabel,
InputLabel,
MenuItem,
Paper,
Select,
Stack,
Switch,
Table,
TableBody,
TableCell,
TableContainer,
TableHead,
TablePagination,
TableRow,
ToggleButton,
ToggleButtonGroup,
Typography
} from '@mui/material';
import { useMemo } from 'react';
import { useLocation,useNavigate,useSearchParams } from 'react-router-dom';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import type { DecisionRequest } from '../../types/workbench';
import { userName } from '../../utils/decisionService';
import { requestKindLabels } from '../../utils/labels';
import { projectById } from '../../utils/selectors';
import { duration,formatTime } from '../../utils/time';

interface DecisionBrowserProps {
  requests: DecisionRequest[];
  showProject?: boolean;
}

const ROWS_PER_PAGE = 10;

export function DecisionBrowser({ requests, showProject = true }: DecisionBrowserProps) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, projects, currentUser } = useWorkbench();

  const scopeAll = params.get('scope') === 'all';
  const status = params.get('status') === 'answered' ? 'answered' : 'pending';
  const sort = params.get('sort') === 'impact' ? 'impact' : 'wait';
  const page = Number(params.get('dpage') ?? '0') || 0;

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);else
    next.delete(key);
    if (key !== 'dpage') next.delete('dpage');
    setParams(next, { replace: true });
  };

  const rows = useMemo(() => {
    const filtered = requests.filter((r) => r.status === status && (scopeAll || r.ownerId === currentUser.id));
    return filtered.sort((a, b) => {
      if (status === 'answered') return (b.userDecision?.at ?? '').localeCompare(a.userDecision?.at ?? '');
      if (sort === 'impact' && b.brief.affected.length !== a.brief.affected.length) return b.brief.affected.length - a.brief.affected.length;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [requests, status, scopeAll, sort, currentUser.id]);

  const from = location.pathname + location.search;
  const open = (r: DecisionRequest) => navigate(`/executions/${r.executionId}?request=${r.id}`, { state: { from } });
  const pageRows = rows.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  return (
    <Paper variant="outlined">
      <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap" alignItems="center" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_, v: string | null) => v && setParam('status', v === 'answered' ? 'answered' : '')}
          aria-label="处理状态">

          <ToggleButton value="pending">待处理</ToggleButton>
          <ToggleButton value="answered">已处理</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={<Switch checked={!scopeAll} onChange={(e) => setParam('scope', e.target.checked ? '' : 'all')} />}
          label="仅看我可处理" />

        {status === 'pending' &&
        <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel id="decision-sort">排序</InputLabel>
            <Select labelId="decision-sort" label="排序" value={sort} onChange={(e) => setParam('sort', e.target.value === 'impact' ? 'impact' : '')}>
              <MenuItem value="wait">等待时间最长优先</MenuItem>
              <MenuItem value="impact">受影响范围优先</MenuItem>
            </Select>
          </FormControl>
        }
        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          排序为原型假设，不推断业务紧急程度；不支持批量提交。
        </Typography>
      </Stack>

      {rows.length === 0 ?
      <Box sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="subtitle2">{status === 'pending' ? '当前无须人工处理' : '暂无已处理记录'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {status === 'pending' && !scopeAll ? '可关闭“仅看我可处理”查看其他可见事项。' : '可在执行详情中查看进展。'}
          </Typography>
        </Box> :

      <>
          <TableContainer>
            <Table sx={{ tableLayout: 'fixed', minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '32%' }}>问题</TableCell>
                  <TableCell>请求类型</TableCell>
                  <TableCell sx={{ minWidth: 220 }}>来源执行</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>受影响范围</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{status === 'pending' ? '已等待' : '处理时间'}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((r) => {
                const exec = state.executions.find((e) => e.id === r.executionId);
                return (
                  <TableRow
                    key={r.id}
                    hover
                    tabIndex={0}
                    sx={{ cursor: 'pointer' }}
                    onClick={() => open(r)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') open(r);
                    }}>

                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>
                          {decisionSummary(r)}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {r.id}
                          </Typography>
                          {r.ownerId !== currentUser.id && <Chip variant="outlined" label={`归属 ${userName(r.ownerId)} · 只读`} />}
                          {r.userDecision &&
                        <Typography variant="caption" color="text.secondary">
                              {r.userDecision.actorName}（{r.userDecision.channel}）
                            </Typography>
                        }
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip variant="outlined" label={requestKindLabels[r.kind]} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{exec?.goal}</Typography>
                        {showProject && exec &&
                      <Typography variant="caption" color="text.secondary">
                            {projectById(exec.projectId, projects)?.name}
                          </Typography>
                      }
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{r.brief.affected[0]}</Typography>
                        {r.brief.affected.length > 1 &&
                      <Typography variant="caption" color="text.secondary">
                            另 {r.brief.affected.length - 1} 项
                          </Typography>
                      }
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {r.status === 'pending' ?
                      <Typography variant="body2" title={`发起于 ${formatTime(r.createdAt)}`}>
                            {duration(r.createdAt)}
                          </Typography> :

                      <Typography variant="body2">{r.userDecision ? formatTime(r.userDecision.at) : '—'}</Typography>
                      }
                      </TableCell>
                    </TableRow>);

              })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
          component="div"
          count={rows.length}
          page={page}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[ROWS_PER_PAGE]}
          onPageChange={(_, p) => setParam('dpage', p ? String(p) : '')}
          labelDisplayedRows={({ from: f, to, count }) => `${f}–${to} / 共 ${count} 条`} />

        </>
      }
    </Paper>);

}
