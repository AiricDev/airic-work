import React from 'react';
import { Alert, Box, Chip, FormControlLabel, Stack, Switch, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { usePlatform, grantActive } from '../../contexts/PlatformContext';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { formatTime } from '../../utils/time';
import { SettingsActions } from './SettingsActions';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

export function TrajectoryMcpSection() {
  const { state, saveMcpPolicy } = usePlatform();
  const form = useSettingsForm(state.mcpPolicy, saveMcpPolicy);
  const userName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">只读轨迹 MCP</Typography>
      <Typography variant="body2" color="text.secondary">
        供外部 Agent 在授权范围内读取 Trajectory、Decision Episode 及必要的版本与 Context 引用。仅只读最小范围：不创建或取消执行、不提交决定、不修改 OM、不读取令牌。
      </Typography>
      <Alert severity="warning">工具名、传输、认证协议与资源 Schema 为 TBD。原型不提供真实 Endpoint。</Alert>
      <FormControlLabel
        control={<Switch checked={form.value.enabled} onChange={(e) => form.set({ enabled: e.target.checked })} />}
        label={form.value.enabled ? '服务已启用' : '服务已停用'} />
      
      <TextField label="记录范围策略" value={form.value.recordScope} onChange={(e) => form.set({ recordScope: e.target.value })} multiline minRows={2} />
      <TextField label="脱敏策略" value={form.value.redaction} onChange={(e) => form.set({ redaction: e.target.value })} multiline minRows={2} />
      <TextField
        label="每页记录数"
        type="number"
        value={form.value.pageSize}
        onChange={(e) => form.set({ pageSize: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
        inputProps={{ min: 1, max: 50 }}
        sx={{ maxWidth: 200 }} />
      
      <SettingsActions dirty={form.dirty} result={form.result} onSave={form.save} onRevert={form.revert} />
      <Typography variant="caption" color="text.secondary">配置不自动授权任何客户端；撤销或收紧策略只限制后续读取，不追回已合法交付的内容。</Typography>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>外部客户端引用（由用户本人授权）</Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>客户端</TableCell><TableCell>授权用户</TableCell><TableCell>范围</TableCell><TableCell>状态</TableCell></TableRow></TableHead>
            <TableBody>
              {state.grants.map((g) =>
              <TableRow key={g.id}>
                  <TableCell>{g.clientName}<Typography variant="caption" color="text.secondary" component="div" sx={{ fontFamily: 'monospace' }}>{g.clientRef}</Typography></TableCell>
                  <TableCell>{userName(g.userId)}</TableCell>
                  <TableCell>{g.scope}</TableCell>
                  <TableCell><Chip variant="outlined" color={grantActive(g) ? 'success' : 'default'} label={grantActive(g) ? '有效' : g.status === '有效' ? '已过期' : g.status} sx={{ height: 22 }} /></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
        <Typography variant="caption" color="text.secondary">管理员只能查看引用与状态，不能代用户同意或撤销。</Typography>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>读取审计</Typography>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead><TableRow><TableCell>时间</TableCell><TableCell>客户端 / 用户</TableCell><TableCell>资源</TableCell><TableCell>结果</TableCell><TableCell>说明</TableCell></TableRow></TableHead>
            <TableBody>
              {state.readLogs.map((l) =>
              <TableRow key={l.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(l.at)}</TableCell>
                  <TableCell>{l.clientName}<Typography variant="caption" color="text.secondary" component="div">代表 {l.userName}</Typography></TableCell>
                  <TableCell>{l.resource}</TableCell>
                  <TableCell><Chip variant="outlined" color={l.result === '已交付' ? 'success' : 'error'} label={l.result} sx={{ height: 22 }} /></TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{l.note}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Box>
      <UnsavedChangesDialog blocker={form.blocker} onSave={() => form.save().ok} onDiscard={form.revert} />
    </Stack>);

}