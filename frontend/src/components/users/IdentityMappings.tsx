import React, { useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import type { ActionResult } from '../../types/platform';
import { usePlatform } from '../../contexts/PlatformContext';
import { formatTime } from '../../utils/time';

export function IdentityMappings({ userId }: {userId: string;}) {
  const { state, addIdentity, verifyIdentity, removeIdentity } = usePlatform();
  const [form, setForm] = useState({ system: 'CertLab（模拟）', instance: 'certlab-demo-01', externalId: '', basis: '' });
  const [result, setResult] = useState<ActionResult | null>(null);
  const [verifying, setVerifying] = useState<string | null>(null);
  const rows = state.identities.filter((i) => i.userId === userId);

  const add = () => {
    if (!form.system.trim() || !form.instance.trim() || !form.externalId.trim()) {
      setResult({ ok: false, message: '请填写来源系统、实例与外部身份 ID。' });
      return;
    }
    const r = addIdentity({ userId, ...form });
    setResult(r);
    if (r.ok) setForm((f) => ({ ...f, externalId: '', basis: '' }));
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        仅在业务系统可验证时映射生效；仅填写引用显示为“待验证”。管理员不能代替用户完成本人同意、查看其令牌或以管理员身份测试成员权限。
      </Alert>
      <Box sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow><TableCell>来源系统 / 实例</TableCell><TableCell>外部身份 ID</TableCell><TableCell>验证依据</TableCell><TableCell>状态</TableCell><TableCell align="right">操作</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((i) =>
            <TableRow key={i.id}>
                <TableCell>{i.system}<Typography variant="caption" color="text.secondary" component="div">{i.instance}</Typography></TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{i.externalId}</TableCell>
                <TableCell>{i.basis || '—'}</TableCell>
                <TableCell>
                  <Chip variant="outlined" color={i.status === '已验证' ? 'success' : 'warning'} label={i.status} />
                  {i.verifiedAt && <Typography variant="caption" color="text.secondary" component="div">{formatTime(i.verifiedAt)}</Typography>}
                </TableCell>
                <TableCell align="right">
                  {i.status === '待验证' &&
                <Button
                  size="small"
                  disabled={verifying === i.id}
                  startIcon={verifying === i.id ? <CircularProgress size={12} /> : undefined}
                  onClick={async () => {
                    setVerifying(i.id);
                    setResult(await verifyIdentity(i.id));
                    setVerifying(null);
                  }}>
                  
                      请求业务系统验证
                    </Button>
                }
                  <Button size="small" color="error" onClick={() => setResult(removeIdentity(i.id))}>移除</Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>尚未关联任何业务身份。</Typography>}
      </Box>
      <Typography variant="subtitle2">新增映射</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <TextField label="来源系统" value={form.system} onChange={(e) => setForm({ ...form, system: e.target.value })} />
        <TextField label="实例" value={form.instance} onChange={(e) => setForm({ ...form, instance: e.target.value })} />
        <TextField label="外部身份 ID / 业务用户 ID" value={form.externalId} onChange={(e) => setForm({ ...form, externalId: e.target.value })} />
        <TextField label="验证依据（可选）" value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })} />
      </Box>
      <Box><Button variant="outlined" onClick={add}>登记映射</Button></Box>
      {result && <Alert severity={result.ok ? 'success' : 'error'}>{result.message}</Alert>}
    </Stack>);

}