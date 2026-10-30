import { useState } from 'react';
import { Alert, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import type { DecisionRequest, Execution } from '../../types/workbench';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { FileInput, type PrototypeFile } from '../FileInput';
export function AskExecutionPanel({ execution }: { execution: Execution; requests: DecisionRequest[]; onLocateRequest: (id: string) => void }) {
  const { sendSteering } = useWorkbench();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<PrototypeFile[]>([]);
  const [sent, setSent] = useState(false);
  return <Paper variant="outlined" sx={{ p: 2, mt: 2 }}><Stack spacing={1.5}>
    <Typography variant="subtitle2">向 Agent 发消息 · Steering Input</Typography>
    <Typography variant="caption">补充指示、询问或提供文件。不会自动回答 DecisionRequest；已结束执行会沿用原 Session、Workspace 和 OM 继续。</Typography>
    <TextField multiline minRows={2} label="工作消息" value={text} onChange={e => setText(e.target.value)} />
    <FileInput files={files} onChange={setFiles} />
    <Button variant="contained" disabled={!text.trim() && !files.length} onClick={() => { sendSteering(execution.id, text.trim() || files.map(f => f.name).join('、'), files); setText(''); setFiles([]); setSent(true); }}>发送消息并继续</Button>
    {sent && <Alert severity="success">输入已保存并交付，原执行已继续（模拟）。此原型不连接真实 Agent。</Alert>}
    {!!execution.uploads?.length && <Stack><Typography variant="caption">本执行 Workspace 文件（浏览器模拟）</Typography>{execution.uploads.map((f, i) => <a key={i} href={f.content} download={f.name}>{f.name}</a>)}</Stack>}
  </Stack></Paper>;
}
