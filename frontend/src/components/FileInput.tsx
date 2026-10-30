import { useState } from 'react';
import { Alert, Button, Link, Stack, Typography } from '@mui/material';
import type { PrototypeFile } from '../types/workbench';
export type { PrototypeFile } from '../types/workbench';
export function FileInput({ files, onChange }: { files: PrototypeFile[]; onChange: (files: PrototypeFile[]) => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <Stack spacing={1}>
    <Button component="label" variant="outlined" disabled={busy}>{busy ? '读取文件…' : '上传文件（可选）'}<input hidden multiple type="file" onChange={async e => {
      const selected = Array.from(e.target.files ?? []); e.target.value = ''; setBusy(true); setError('');
      try {
        if (selected.reduce((sum, f) => sum + f.size, files.reduce((sum, f) => sum + f.size, 0)) > 1024 * 1024) throw new Error('原型单次输入总文件限 1 MB，请移除较大文件后重试。');
        const added = await Promise.all(selected.map(f => new Promise<PrototypeFile>((resolve, reject) => { const r = new FileReader(); r.onerror = () => reject(new Error('文件读取失败，请重试')); r.onload = () => resolve({ name: f.name, size: f.size, content: String(r.result) }); r.readAsDataURL(f); })));
        onChange([...files, ...added]);
      } catch (err) { setError(String(err)); } finally { setBusy(false); }
    }} /></Button>
    {files.map((f, i) => <Typography key={i}><Link href={f.content} download={f.name}>{f.name}</Link> · {f.size} bytes <Button size="small" onClick={() => onChange(files.filter((_, j) => j !== i))}>移除</Button></Typography>)}
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
