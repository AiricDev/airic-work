import { useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Chip, MenuItem, Stack, TextField, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { Execution } from '../../types/workbench';
import { formatTime } from '../../utils/time';

// Explicit fixture classification: missing declarations remain unknown, never inferred from names.
const declarations: Record<string, 'read' | 'write'> = {
  'log-a1': 'read', 'log-a2': 'read', 'log-a3': 'read', 'log-a4': 'write',
  'log-b1': 'read', 'log-d1': 'read', 'log-d2': 'read', 'log-c1': 'write'
};
const labels = { read: '读取', write: '写入', unknown: '类型未知' };
export function McpCalls({ execution }: { execution: Execution }) {
  const [filter, setFilter] = useState('all');
  const unknown = execution.logs.filter(l => !declarations[l.id]).length;
  return <Stack spacing={1.5} sx={{ pt: 2 }}>
    <Alert severity="info">虚构 MCP 调用，用于交互演示；参数和返回仅展示已记录信息，不推断业务成功。</Alert>
    <TextField select label="操作类型" value={filter} onChange={e => setFilter(e.target.value)}>
      <MenuItem value="all">全部调用</MenuItem><MenuItem value="read">读取</MenuItem><MenuItem value="write">写入</MenuItem><MenuItem value="unknown">类型未知</MenuItem>
    </TextField>
    {unknown > 0 && <Alert severity="warning">还有 {unknown} 条类型未知的调用，写入筛选不能证明其余调用均为读取。</Alert>}
    {execution.logs.filter(l => filter === 'all' || (declarations[l.id] ?? 'unknown') === filter).map(l => <Accordion key={l.id} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}><Stack spacing={0.5}>
        <Typography variant="body2">{formatTime(l.at)} · {execution.source.system} · {l.tool}</Typography>
        <Typography variant="body2">{l.call}</Typography>
        <Stack direction="row" spacing={1}><Chip label={labels[declarations[l.id] ?? 'unknown']} /><Chip label={l.receiptStatus === 'confirmed' ? '已返回 · 查看结果' : l.receiptStatus === 'pending' ? '调用中' : '结果未知'} /></Stack>
      </Stack></AccordionSummary>
      <AccordionDetails><Typography variant="caption">分类来源：{declarations[l.id] ? '演示连接配置 v1' : '未声明'}。调用标识：{l.id}</Typography>
        <Typography variant="subtitle2">工具参数</Typography><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{JSON.stringify({ recordedInput: l.call, limitation: '原型未提供完整 wire 参数' }, null, 2)}</Box>
        <Typography variant="subtitle2">工具返回</Typography><Box component="pre" sx={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ recordedOutput: l.receipt }, null, 2)}</Box>
        <Typography variant="caption">未记录重试关系、业务链接或判断关联时不推测补全。此列表来自本执行的 Session 演示记录。</Typography>
      </AccordionDetails>
    </Accordion>)}
    {execution.logs.filter(l => filter === 'all' || (declarations[l.id] ?? 'unknown') === filter).length === 0 && <Typography>当前筛选下没有调用。</Typography>}
  </Stack>;
}
