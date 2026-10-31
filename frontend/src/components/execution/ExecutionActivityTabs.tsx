import { Alert,Box,Link,Stack,Tab,Tabs,Typography } from '@mui/material';
import { useState } from 'react';
import { loadHistory } from '../../api/history';
import { useApiQuery } from '../../api/useApiQuery';
import type { Execution } from '../../types/workbench';
import { formatTime } from '../../utils/time';
import { McpCalls } from './McpCalls';
export function ExecutionActivityTabs({ execution, onOpenRequest }: { execution: Execution; onOpenEvidence: (id: string) => void; onOpenRequest: (id: string) => void }) {
  const history = useApiQuery(['session',execution.id],()=>loadHistory(execution.id));
  const [tab, setTab] = useState(0);
  return <Box><Tabs value={tab} onChange={(_, v: number) => setTab(v)}><Tab label="进展" /><Tab label="Session" /><Tab label="MCP 操作" /></Tabs>
    <Box sx={{ display: tab === 2 ? 'block' : 'none' }}><McpCalls key={execution.id} execution={execution} /></Box>
    {history.error && <Alert severity="error">{history.error}</Alert>}{history.data?.limitations.map((s,i)=><Alert key={i} severity="warning">{s}</Alert>)}
    {tab !== 2 && <Stack spacing={1.5} sx={{ pt: 2 }}>
      <Typography variant="caption">Session 与 Trajectory 是同一执行历史；执行结束不等于业务正式完成。</Typography>
      {[...(history.data?.events ?? [])].reverse().map(e => <Box key={e.id} sx={{ borderBottom: 1, borderColor: 'divider', pb: 1 }}><Typography variant="caption">{formatTime(e.at)} · {e.kind}</Typography><Typography>{e.title}</Typography><Typography variant="body2">{e.detail}</Typography>{e.requestId && <Link component="button" onClick={() => onOpenRequest(e.requestId!)}>DecisionRequest {e.requestId}</Link>}</Box>)}
    </Stack>}
  </Box>;
}
