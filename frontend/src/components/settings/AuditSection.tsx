import React, { useState } from 'react';
import { Box, Chip, InputAdornment, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { usePlatform } from '../../contexts/PlatformContext';
import { formatTime } from '../../utils/time';

export function AuditSection({ target }: {target?: string;}) {
  const { state } = usePlatform();
  const [q, setQ] = useState('');
  const rows = state.audit.filter(
    (a) => (!target || a.target.includes(target)) && `${a.actorName}${a.action}${a.target}${a.summary}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Stack spacing={1.5}>
      {!target && <Typography variant="subtitle1" component="h2">管理审计</Typography>}
      <TextField
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="搜索操作者、操作或对象"
        sx={{ maxWidth: 360 }}
        inputProps={{ 'aria-label': '搜索审计记录' }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      
      <Box sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow><TableCell>时间</TableCell><TableCell>操作者</TableCell><TableCell>操作</TableCell><TableCell>对象</TableCell><TableCell>结果</TableCell><TableCell>脱敏摘要</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {rows.map((a) =>
            <TableRow key={a.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(a.at)}</TableCell>
                <TableCell>{a.actorName}</TableCell>
                <TableCell>{a.action}</TableCell>
                <TableCell>{a.target}</TableCell>
                <TableCell><Chip variant="outlined" color={a.result === '成功' ? 'success' : a.result === '失败' ? 'error' : 'warning'} label={a.result} /></TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{a.summary}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 2 }}>没有记录。</Typography>}
      </Box>
      <Typography variant="caption" color="text.secondary">审计记录只读，不显示秘密值。</Typography>
    </Stack>);

}