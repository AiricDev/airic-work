import { Alert,Box,Link,Paper,Table,TableBody,TableCell,TableContainer,TableHead,TablePagination,TableRow,Typography } from '@mui/material';
import { Link as RouterLink,useNavigate,useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useApiQuery } from '../api/useApiQuery';
import { PageHeader } from '../components/PageHeader';
import { OMSourceSummary } from '../components/om/OMSourceSummary';
import { usePlatform } from '../contexts/PlatformContext';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { shortSha } from '../utils/omRepository';
import { formatTime } from '../utils/time';

const ROWS = 10;

export function OMHistory() {
  const { state } = usePlatform();
  const wb = useWorkbench();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '0') || 0;
  const history = useApiQuery(['om-history'],()=>api('methodHistory'));
  const commits = history.data?.commits.map(c=>({...c,message:c.subject,author:'未提供',changes:[]})) ?? [];
  const rows = commits.slice(page * ROWS, page * ROWS + ROWS);
  const usedBy = (sha: string) => wb.state.executions.filter((e) => sha.startsWith(e.omCommit)).length;

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader title="Operating Model" description="提交历史来自 Git 原始记录。提交描述不代表改进成效已被证明。" />
      <OMSourceSummary />
      <Alert severity="info" sx={{ mb: 2 }}>
        显示允许来源的本地 Git 历史，不自动联网。新提交只供未来新执行使用；既有执行保持其固定 SHA。
      </Alert>
      {history.error && <Alert severity="error">{history.error}</Alert>}
      {history.loading && <Typography>正在读取历史…</Typography>}
      {history.data?.limitations.map(s=><Alert severity="warning" key={s}>{s}</Alert>)}
      <Paper variant="outlined">
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>SHA</TableCell>
                <TableCell sx={{ minWidth: 280 }}>提交描述</TableCell>
                <TableCell>作者</TableCell>
                <TableCell>时间</TableCell>
                <TableCell>文件</TableCell>
                <TableCell>执行使用</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c) => {
                const n = usedBy(c.sha);
                return (
                  <TableRow key={c.sha} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/om/commits/${c.sha}`)}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      <Link component={RouterLink} to={`/om/commits/${c.sha}`} onClick={(e) => e.stopPropagation()}>{shortSha(c.sha)}</Link>
                      {c.sha === state.omSync.latestConfirmedSha && <Typography variant="caption" color="success.main" component="div">最新确认</Typography>}
                    </TableCell>
                    <TableCell>{c.message.split('\n')[0]}</TableCell>
                    <TableCell>{c.author}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(c.at)}</TableCell>
                    <TableCell>未提供</TableCell>
                    <TableCell>{n > 0 ? `${n} 个执行` : '—'}</TableCell>
                  </TableRow>);

              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={commits.length}
          page={page}
          rowsPerPage={ROWS}
          rowsPerPageOptions={[ROWS]}
          onPageChange={(_, p) => setParams(p ? { page: String(p) } : {})}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} / 共 ${count} 条`} />

      </Paper>
    </Box>);

}
