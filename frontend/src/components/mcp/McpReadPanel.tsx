import { useState } from 'react';
import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useWorkbench } from '../../contexts/WorkbenchContext';
export function McpReadPanel({ defaultExecutionId }: { defaultExecutionId?: string }) {
  const { state, currentUser } = useWorkbench();
  const executions = state.executions.filter(e => e.ownerId === currentUser.id);
  const [id, setId] = useState(defaultExecutionId ?? executions[0]?.id ?? '');
  const [result, setResult] = useState('');
  return <Stack spacing={2}><Typography variant="subtitle1">Airic Work MCP 只读预览</Typography><Alert severity="info">模拟集成方 token 已映射为 {currentUser.name}；与工作台使用相同的用户访问范围，不新增客户端授权流程。</Alert>
    <TextField select label="执行" value={id} onChange={e => setId(e.target.value)}>{executions.map(e => <MenuItem key={e.id} value={e.id}>{e.goal}</MenuItem>)}</TextField>
    <Button disabled={!id} onClick={() => { const e = executions.find(e => e.id === id); setResult(e ? JSON.stringify({ executionId: e.id, session: e.events, omSha: e.omCommit }, null, 2) : '无权读取'); }}>预览 Session 读取</Button>
    <Typography component="pre" sx={{ whiteSpace: 'pre-wrap' }}>{result}</Typography><Typography variant="caption">未连接真实 MCP；此入口只读，不执行任何业务操作。</Typography>
  </Stack>;
}
