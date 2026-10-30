import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Switch,
  Typography } from
'@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { demoUsers } from '../../data/users';
import type { SubmitMode } from '../../types/workbench';
import type { PlatformDemoSettings } from '../../types/platform';
import { nowIso } from '../../utils/time';
import { userName } from '../../utils/decisionService';

interface DemoConsoleProps {
  open: boolean;
  onClose: () => void;
}

export function DemoConsole({ open, onClose }: DemoConsoleProps) {
  const { state, currentUser, setUser, updateSettings, resetDemo, simulateExternalResolve, simulateContextUpdate } = useWorkbench();
  const platform = usePlatform();
  const { settings } = state;
  const pending = state.requests.filter((r) => r.status === 'pending');
  const [targetId, setTargetId] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const target = pending.find((r) => r.id === targetId) ? targetId : pending[0]?.id ?? '';

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 400 } } }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1">演示控制台</Typography>
          <Typography variant="caption" color="text.secondary">
            与正式工作区分离，仅用于模拟场景；所有结果可重复验证。
          </Typography>
        </Box>
        <IconButton aria-label="关闭演示控制台" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Stack spacing={2.5} sx={{ p: 2, overflow: 'auto' }}>
        <Box>
          <Typography variant="overline" color="text.secondary">
            模拟身份
          </Typography>
          <RadioGroup value={currentUser.id} onChange={(e) => setUser(e.target.value)}>
            {demoUsers.map((u) => {
              const acc = platform.state.users.find((x) => x.id === u.id) ?? u;
              return (
                <FormControlLabel
                  key={u.id}
                  value={u.id}
                  control={<Radio size="small" />}
                  label={`${acc.name} · ${acc.systemRole === 'admin' ? '管理员' : '成员'} · ${u.role}${acc.status === 'disabled' ? '（已停用）' : ''}`} />);


            })}
          </RadioGroup>
          <Typography variant="caption" color="text.secondary">
            切换为“陈立”可验证管理功能；“李卫”验证无处理权限；“赵强”验证已停用账户。
          </Typography>
        </Box>

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            知识、实践与集成
          </Typography>
          <Stack>
            <FormControlLabel
              control={<Switch checked={platform.state.demo.gitSyncFail} onChange={(e) => platform.updateDemo({ gitSyncFail: e.target.checked })} />}
              label="Git 同步 / 索引失败" />

            <FormControlLabel
              control={<Switch checked={platform.state.demo.trajectoryMissing} onChange={(e) => platform.updateDemo({ trajectoryMissing: e.target.checked })} />}
              label="轨迹记录缺失" />

            <FormControlLabel
              control={<Switch checked={platform.state.demo.mcpReadDenied} onChange={(e) => platform.updateDemo({ mcpReadDenied: e.target.checked })} />}
              label="外部 MCP 读取被拒绝" />

            <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start', mt: 0.5 }} onClick={() => platform.expireDelegation('DG-01')}>
              使张敏 CertLab 授权失效
            </Button>
          </Stack>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="console-conn">连接测试结果</InputLabel>
            <Select
              labelId="console-conn"
              label="连接测试结果"
              value={platform.state.demo.connectionTestFailure}
              onChange={(e) => platform.updateDemo({ connectionTestFailure: e.target.value as PlatformDemoSettings['connectionTestFailure'] })}>

              <MenuItem value="none">成功</MenuItem>
              <MenuItem value="auth">失败：认证</MenuItem>
              <MenuItem value="network">失败：网络</MenuItem>
              <MenuItem value="capability">失败：能力不可用</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            提交行为
          </Typography>
          <RadioGroup value={settings.submitMode} onChange={(e) => updateSettings({ submitMode: e.target.value as SubmitMode })}>
            <FormControlLabel value="normal" control={<Radio size="small" />} label="正常提交" />
            <FormControlLabel value="unknown" control={<Radio size="small" />} label="提交结果未知（稍后才被接受）" />
            <FormControlLabel value="failed" control={<Radio size="small" />} label="提交失败（未被接受）" />
          </RadioGroup>
        </Box>

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            环境与异常
          </Typography>
          <Stack>
            <FormControlLabel
              control={<Switch checked={settings.evidenceUnavailable} onChange={(e) => updateSettings({ evidenceUnavailable: e.target.checked })} />}
              label="证据不可访问" />

            <FormControlLabel
              control={<Switch checked={settings.cancelDelayed} onChange={(e) => updateSettings({ cancelDelayed: e.target.checked })} />}
              label="取消延迟（运行时暂不能确认）" />

            <FormControlLabel
              control={
              <Switch
                checked={Boolean(settings.connectionLostAt)}
                onChange={(e) => updateSettings({ connectionLostAt: e.target.checked ? nowIso() : null })} />

              }
              label="连接中断" />

            <FormControlLabel
              control={<Switch checked={settings.briefLoadFail} onChange={(e) => updateSettings({ briefLoadFail: e.target.checked })} />}
              label="Decision Brief 加载失败" />

            <FormControlLabel
              control={<Switch checked={settings.sessionExpired} onChange={(e) => updateSettings({ sessionExpired: e.target.checked })} />}
              label="会话失效" />

          </Stack>
        </Box>

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            业务系统事件
          </Typography>
          {pending.length === 0 ?
          <Typography color="text.secondary">当前没有待处理请求。</Typography> :

          <Stack spacing={1.5}>
              <FormControl fullWidth size="small">
                <InputLabel id="console-target">目标请求</InputLabel>
                <Select labelId="console-target" label="目标请求" value={target} onChange={(e) => setTargetId(e.target.value)}>
                  {pending.map((r) =>
                <MenuItem key={r.id} value={r.id}>
                      {r.id} · {r.question.slice(0, 18)}…
                    </MenuItem>
                )}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => simulateExternalResolve(target)} disabled={!target}>
                  他端已处理
                </Button>
                <Button variant="outlined" onClick={() => simulateContextUpdate(target)} disabled={!target}>
                  Context 更新
                </Button>
              </Stack>
            </Stack>
          }
        </Box>

        <Divider />

        <Box>
          <Typography variant="overline" color="text.secondary">
            业务系统视图（读取同一份记录）
          </Typography>
          <Stack spacing={1} sx={{ mt: 0.5 }}>
            {state.requests.map((r) =>
            <Box key={r.id} sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {r.id}
                  </Typography>
                  <Chip
                  variant="outlined"
                  color={r.status === 'pending' ? 'warning' : 'success'}
                  label={r.status === 'pending' ? '待处理' : '已处理'} />

                  <Typography variant="caption" color="text.secondary">
                    v{r.version} · 归属 {userName(r.ownerId)}
                  </Typography>
                </Stack>
                {r.userDecision &&
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                    {r.userDecision.actorName}（{r.userDecision.channel}）：{r.userDecision.content}
                  </Typography>
              }
              </Box>
            )}
          </Stack>
          <Link component={RouterLink} to="/business?ref=DEMO-APP-0042" onClick={onClose} sx={{ display: 'inline-block', mt: 1 }}>
            打开模拟业务系统页面
          </Link>
        </Box>

        <Divider />

        <Box>
          <Button color="error" variant="outlined" startIcon={<RestartAltIcon />} onClick={() => setConfirmReset(true)}>
            重置演示
          </Button>
          <Alert severity="info" sx={{ mt: 1.5 }}>
            演示数据保存在本浏览器。草稿与已接受记录分开保存；重置会同时清空两者。
          </Alert>
        </Box>
      </Stack>

      <Dialog open={confirmReset} onClose={() => setConfirmReset(false)}>
        <DialogTitle>重置演示数据？</DialogTitle>
        <DialogContent>
          <DialogContentText>所有模拟处理记录、取消请求、本地草稿，以及用户、设置、分析与审阅记录将恢复为初始演示状态。</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReset(false)}>取消</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              resetDemo();
              platform.resetPlatform();
              setConfirmReset(false);
            }}>

            重置
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>);

}
