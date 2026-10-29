import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography } from
'@mui/material';
import type { ActionResult, McpResource } from '../../types/platform';
import { usePlatform, grantActive } from '../../contexts/PlatformContext';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { buildMcpPayload, type McpPayload } from '../../utils/mcpPreview';
import { formatTime } from '../../utils/time';

const resources: McpResource[] = ['执行记录索引', 'Trajectory 分页', 'Decision Episode', '版本与 Context 引用'];

export function McpReadPanel({ defaultExecutionId }: {defaultExecutionId?: string;}) {
  const { state, account, mcpRead } = usePlatform();
  const wb = useWorkbench();
  const grants = state.grants.filter((g) => g.userId === account.id);
  const executions = wb.state.executions.filter((e) => wb.currentUser.visibleProjectIds.includes(e.projectId));
  const [grantId, setGrantId] = useState(grants[0]?.id ?? '');
  const [resource, setResource] = useState<McpResource>('Trajectory 分页');
  const [executionId, setExecutionId] = useState(defaultExecutionId ?? executions[0]?.id ?? '');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<(ActionResult & {payload?: McpPayload;}) | null>(null);
  const logs = state.readLogs.filter((l) => l.userName === account.name).slice(0, 5);

  const read = async (p: number) => {
    setBusy(true);
    setPage(p);
    const r = await mcpRead({ grantId, resource, executionId, page: p });
    const exec = wb.state.executions.find((e) => e.id === executionId);
    setResult(r.ok && exec ? { ...r, payload: buildMcpPayload(resource, exec, p, state.mcpPolicy.pageSize, state.demo.trajectoryMissing) } : r);
    setBusy(false);
  };

  if (grants.length === 0) {
    return (
      <Alert severity="info">
        你还没有授权任何外部客户端。客户端授权由本人在<Link component={RouterLink} to="/settings/profile">个人设置</Link>中管理。
      </Alert>);

  }

  const total = result?.payload?.total;
  const pages = total ? Math.ceil(total / state.mcpPolicy.pageSize) : 0;

  return (
    <Stack spacing={1.5}>
      <Alert severity="warning">
        演示面板：模拟外部 Agent 通过只读 MCP 读取记录，不代表真实 Endpoint，也不会连接本地 Agent。工具名、传输与认证协议 TBD。
      </Alert>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <FormControl size="small">
          <InputLabel id="mcp-client">调用客户端</InputLabel>
          <Select labelId="mcp-client" label="调用客户端" value={grantId} onChange={(e) => {setGrantId(e.target.value);setResult(null);}}>
            {grants.map((g) =>
            <MenuItem key={g.id} value={g.id}>{g.clientName}{grantActive(g) ? '' : `（${g.status === '有效' ? '已过期' : g.status}）`}</MenuItem>
            )}
          </Select>
        </FormControl>
        <FormControl size="small">
          <InputLabel id="mcp-res">资源</InputLabel>
          <Select labelId="mcp-res" label="资源" value={resource} onChange={(e) => {setResource(e.target.value as McpResource);setResult(null);}}>
            {resources.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ gridColumn: { sm: '1 / -1' } }}>
          <InputLabel id="mcp-exec">执行</InputLabel>
          <Select labelId="mcp-exec" label="执行" value={executionId} onChange={(e) => {setExecutionId(e.target.value);setResult(null);}}>
            {executions.map((e) => <MenuItem key={e.id} value={e.id}>{e.id} · {e.goal}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Box>
        <Button variant="outlined" disabled={busy || !grantId || !executionId} onClick={() => read(0)} startIcon={busy ? <CircularProgress size={14} /> : undefined}>
          {busy ? '授权检查中…' : '模拟只读调用'}
        </Button>
      </Box>

      {result &&
      <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">授权检查</Typography>
            <Chip variant="outlined" color={result.ok ? 'success' : 'error'} label={result.ok ? '通过' : '拒绝'} sx={{ height: 22 }} />
          </Stack>
          <Typography variant="body2" color="text.secondary">{result.message}</Typography>
          {result.payload &&
        <>
              <Typography variant="subtitle2" sx={{ mt: 1.5 }}>返回（虚构记录）{total !== undefined && ` · 第 ${page + 1}/${Math.max(pages, 1)} 页`}</Typography>
              {result.payload.items.length === 0 ?
          <Typography variant="body2" color="text.secondary">无记录。</Typography> :

          <Box component="ul" sx={{ m: 0, pl: 2.5, fontFamily: 'monospace', fontSize: 12 }}>
                  {result.payload.items.map((i) => <li key={i}>{i}</li>)}
                </Box>
          }
              <Typography variant="subtitle2" sx={{ mt: 1 }}>限制说明</Typography>
              {result.payload.notes.map((n) => <Typography key={n} variant="caption" color="text.secondary" component="div">· {n}</Typography>)}
              {pages > 1 &&
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Button size="small" disabled={busy || page === 0} onClick={() => read(page - 1)}>上一页</Button>
                  <Button size="small" disabled={busy || page >= pages - 1} onClick={() => read(page + 1)}>下一页</Button>
                </Stack>
          }
            </>
        }
        </Box>
      }

      <Typography variant="subtitle2">我的近期读取审计</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead><TableRow><TableCell>时间</TableCell><TableCell>客户端</TableCell><TableCell>资源</TableCell><TableCell>结果</TableCell><TableCell>说明</TableCell></TableRow></TableHead>
          <TableBody>
            {logs.map((l) =>
            <TableRow key={l.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(l.at)}</TableCell>
                <TableCell>{l.clientName}</TableCell>
                <TableCell>{l.resource}</TableCell>
                <TableCell><Chip variant="outlined" color={l.result === '已交付' ? 'success' : 'error'} label={l.result} sx={{ height: 22 }} /></TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{l.note}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </Stack>);

}