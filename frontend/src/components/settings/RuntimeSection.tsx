import React from 'react';
import { Alert, Box, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { dataPolicies, runtimeCapabilities, runtimeSkills } from '../../data/integrations';

export function RuntimeSection({ mode }: {mode: 'runtime' | 'data';}) {
  if (mode === 'data') {
    return (
      <Stack spacing={2}>
        <Typography variant="subtitle1" component="h2">数据与安全</Typography>
        <Alert severity="info">原型只读展示策略摘要。不预填未经确认的保留天数，不提供一键删除审计或全量导出。</Alert>
        {dataPolicies.map((p) =>
        <Box key={p.title} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="body2" fontWeight={600}>{p.title}</Typography>
            <Typography variant="body2">{p.summary}</Typography>
            <Typography variant="caption" color="text.secondary">来源：{p.source}</Typography>
          </Box>
        )}
      </Stack>);

  }
  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">Runtime 与 Skills</Typography>
      <Typography variant="body2" color="text.secondary">目标运行时：Pi Durable。环境：演示（未连接）。原型只读，不提供热切换或 system prompt 编辑。</Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead><TableRow><TableCell>能力</TableCell><TableCell>类别</TableCell><TableCell>状态</TableCell><TableCell>说明</TableCell></TableRow></TableHead>
          <TableBody>
            {runtimeCapabilities.map((c) =>
            <TableRow key={c.name}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.category}</TableCell>
                <TableCell><Chip variant="outlined" color={c.status === '已验证' ? 'success' : c.status === '不可用' ? 'error' : 'default'} label={c.status} /></TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{c.note}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
      <Typography variant="subtitle2">访问边界</Typography>
      <Typography variant="body2" color="text.secondary">文件、Shell、网络与 MCP 访问按执行范围限定；资源配额 TBD。</Typography>
      <Typography variant="subtitle2">执行 Skill 版本</Typography>
      {runtimeSkills.map((s) =>
      <Box key={s.name} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" fontWeight={600}>{s.name} <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 400 }}>{s.version}</Box></Typography>
          <Typography variant="body2">{s.role}</Typography>
          <Typography variant="caption" color="text.secondary">验证：{s.validation}</Typography>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary">后台不装配反思或学习模块；OME 仅在外部环境中使用。</Typography>
      <Alert severity="warning">版本更新需进行影响评估与代表性 OM 回归验证；既有执行不会因更新而热切换 Runtime 或 Skill。</Alert>
    </Stack>);

}