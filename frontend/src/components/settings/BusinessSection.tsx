import React, { useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { usePlatform } from '../../contexts/PlatformContext';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { apiCallers, businessCapabilities } from '../../data/integrations';
import { formatTime } from '../../utils/time';
import { SettingsActions } from './SettingsActions';
import { ConnectionTestResult } from './ConnectionTestResult';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

export function BusinessSection() {
  const { state, saveBusiness, testBusiness } = usePlatform();
  const form = useSettingsForm(state.business, saveBusiness);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    await testBusiness();
    setTesting(false);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">业务连接（业务 MCP）</Typography>
      <Typography variant="body2" color="text.secondary">
        出站业务 MCP 是领域能力接入方向，与 Git、标准 API、只读轨迹 MCP 分开配置。连接测试不代表任何用户的本人授权或业务操作权限。
      </Typography>
      <TextField label="系统及实例 ID" value={form.value.sourceId} onChange={(e) => form.set({ sourceId: e.target.value })} />
      <TextField label="显示名" value={form.value.displayName} onChange={(e) => form.set({ displayName: e.target.value })} />
      <TextField label="业务跳转模板" value={form.value.jumpTemplate} onChange={(e) => form.set({ jumpTemplate: e.target.value })} helperText="演示路由；{ref} 替换为业务引用" />
      <TextField label="MCP Endpoint" value={form.value.mcpEndpoint} onChange={(e) => form.set({ mcpEndpoint: e.target.value })} />
      <TextField label="身份来源" value={form.value.identitySource ?? ''} onChange={(e) => form.set({ identitySource: e.target.value })} helperText="用于验证业务身份映射的可信目录" />
      <TextField label="客户端配置引用" value={form.value.credentialRef} onChange={(e) => form.set({ credentialRef: e.target.value })} helperText="仅填写引用；真实凭据由服务端托管，不回显" />
      <SettingsActions
        dirty={form.dirty}
        result={form.result}
        onSave={form.save}
        onRevert={form.revert}
        extra={
        <Button variant="outlined" onClick={test} disabled={testing} startIcon={testing ? <CircularProgress size={14} /> : undefined}>
            {testing ? '测试中…' : '测试连接（不写入）'}
          </Button>
        } />
      
      <ConnectionTestResult result={state.businessTest} />
      <Box>
        <Typography variant="subtitle2">可发现能力（演示）</Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
          {businessCapabilities.map((c) => <Chip key={c} variant="outlined" label={c} />)}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
          MCP 读写按实际用户的业务权限与任务范围校验；平台不使用共享服务账号或管理员账号代替用户操作。
        </Typography>
      </Box>

      <Divider />

      <Typography variant="subtitle1" component="h2">标准任务与决策 API 接入</Typography>
      <Alert severity="info">字段、认证协议与真实令牌发行均为 TBD。此处不编造已发布端点或令牌。</Alert>
      {apiCallers.map((c) =>
      <Box key={c.id} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>{c.id} · {c.system}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{c.identityNote}</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
            {c.operations.map((o) => <Chip key={o} variant="outlined" label={o} />)}
          </Stack>
          <Table sx={{ mt: 1 }}>
            <TableHead><TableRow><TableCell>时间</TableCell><TableCell>操作</TableCell><TableCell>结果</TableCell></TableRow></TableHead>
            <TableBody>
              {c.recentAccess.map((a) =>
            <TableRow key={a.at + a.operation}><TableCell>{formatTime(a.at)}</TableCell><TableCell>{a.operation}</TableCell><TableCell>{a.result}</TableCell></TableRow>
            )}
            </TableBody>
          </Table>
        </Box>
      )}
      <UnsavedChangesDialog blocker={form.blocker} onSave={() => form.save().ok} onDiscard={form.revert} />
    </Stack>);

}