import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import SearchIcon from '@mui/icons-material/Search';
import {
Box,
Button,
Chip,
FormControl,
InputAdornment,
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
TextField,
Typography
} from '@mui/material';
import { useMemo } from 'react';
import { Link as RouterLink,useLocation,useNavigate,useSearchParams } from 'react-router-dom';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import type { Execution } from '../../types/workbench';
import { currentWorkText,firstActionableRequest,pendingFor,projectById } from '../../utils/selectors';
import { formatTime,fromNow } from '../../utils/time';
import { StatusTag } from '../StatusTag';

interface ExecutionBrowserProps {
  executions: Execution[];
  showProject?: boolean;
}

const ROWS_PER_PAGE = 10;

export function ExecutionBrowser({ executions, showProject = false }: ExecutionBrowserProps) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, projects, currentUser } = useWorkbench();

  const q = params.get('q') ?? '';
  const source = params.get('source') ?? '';
  const mine = params.get('mine') === '1';
  const page = Number(params.get('page') ?? '0') || 0;
  const hasFilter = Boolean(q || source || mine);

  const sources = useMemo(() => Array.from(new Set(executions.map((e) => e.source.system))), [executions]);

  const rows = useMemo(
    () =>
    executions.
    filter((e) => {
      const text = `${e.goal} ${e.id} ${e.source.ref} ${e.source.label}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (source && e.source.system !== source) return false;
      if (mine && !state.requests.some((r) => r.executionId === e.id && r.status === 'pending' && r.ownerId === currentUser.id)) return false;
      return true;
    }).
    sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [executions, q, source, mine, state.requests, currentUser.id]
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);else
    next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const clear = () => {
    const next = new URLSearchParams(params);
    ['q', 'source', 'mine', 'page'].forEach((k) => next.delete(k));
    setParams(next, { replace: true });
  };

  const from = location.pathname + location.search;
  const open = (id: string, requestId?: string) =>
  navigate(`/executions/${id}${requestId ? `?request=${requestId}` : ''}`, { state: { from } });

  const pageRows = rows.slice(page * ROWS_PER_PAGE, page * ROWS_PER_PAGE + ROWS_PER_PAGE);

  return (
    <Paper variant="outlined">
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          value={q}
          onChange={(e) => setParam('q', e.target.value)}
          placeholder="搜索目标、执行 ID 或业务引用"
          inputProps={{ 'aria-label': '搜索执行' }}
          sx={{ width: { xs: '100%', sm: 300 } }}
          InputProps={{
            startAdornment:
            <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>

          }} />

        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel id="source-filter">来源</InputLabel>
          <Select labelId="source-filter" label="来源" value={source} onChange={(e) => setParam('source', e.target.value)}>
            <MenuItem value="">全部来源</MenuItem>
            {sources.map((s) =>
            <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            )}
          </Select>
        </FormControl>
        <Chip
          icon={<PersonOutlineIcon />}
          label="需我处理"
          color={mine ? 'primary' : 'default'}
          variant={mine ? 'filled' : 'outlined'}
          onClick={() => setParam('mine', mine ? '' : '1')}
          aria-pressed={mine} />

        {hasFilter && <Button onClick={clear}>清除筛选</Button>}
      </Stack>

      {executions.length === 0 ?
      <Box sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="subtitle2">暂无可见执行</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            执行主要由业务系统通过任务 API 发起，工作台不提供新建入口。
          </Typography>
        </Box> :
      rows.length === 0 ?
      <Box sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="subtitle2">没有符合筛选条件的执行</Typography>
          <Button sx={{ mt: 1 }} onClick={clear}>
            清除筛选
          </Button>
        </Box> :

      <>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 260 }}>目标 / 业务来源</TableCell>
                  {showProject && <TableCell sx={{ minWidth: 160 }}>项目</TableCell>}
                  <TableCell sx={{ minWidth: 240 }}>当前工作</TableCell>
                  <TableCell align="center">待决</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>最近更新</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((e) => {
                const pending = pendingFor(state.requests, e.id);
                const first = firstActionableRequest(state.requests, e.id, currentUser);
                return (
                  <TableRow
                    key={e.id}
                    hover
                    tabIndex={0}
                    onClick={() => open(e.id)}
                    onKeyDown={(ev) => {
                      if (ev.key === 'Enter') open(e.id);
                    }}
                    sx={{ cursor: 'pointer' }}>

                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {e.goal}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            {e.id}
                          </Typography>
                          <Link
                          component={RouterLink}
                          to={`/business?ref=${e.source.ref}`}
                          onClick={(ev) => ev.stopPropagation()}
                          variant="caption"
                          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>

                            {e.source.system} · {e.source.ref}
                            <OpenInNewIcon sx={{ fontSize: 12 }} />
                          </Link>
                        </Stack>
                      </TableCell>
                      {showProject &&
                    <TableCell>
                          <Typography variant="body2">{projectById(e.projectId, projects)?.name}</Typography>
                        </TableCell>
                    }
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <StatusTag execution={e} pendingCount={pending.length} />
                          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>
                            {currentWorkText(e)}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        {pending.length > 0 && first ?
                      <Chip
                        label={pending.length}
                        color="warning"
                        clickable
                        aria-label={`${pending.length} 项待决，进入首个可处理请求`}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          open(e.id, first.id);
                        }} /> :


                      <Typography variant="body2" color="text.disabled">
                            0
                          </Typography>
                      }
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" title={formatTime(e.updatedAt)}>
                          {fromNow(e.updatedAt)}
                        </Typography>
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
          onPageChange={(_, p) => setParam('page', p ? String(p) : '')}
          labelDisplayedRows={({ from: f, to, count }) => `${f}–${to} / 共 ${count} 条`} />

        </>
      }
    </Paper>);

}
