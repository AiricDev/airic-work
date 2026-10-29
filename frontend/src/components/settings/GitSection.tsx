import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography } from
'@mui/material';
import { usePlatform } from '../../contexts/PlatformContext';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { useSettingsForm } from '../../hooks/useSettingsForm';
import { formatTime } from '../../utils/time';
import { shortSha } from '../../utils/omRepository';
import { SettingsActions } from './SettingsActions';
import { ConnectionTestResult } from './ConnectionTestResult';
import { UnsavedChangesDialog } from '../UnsavedChangesDialog';

export function GitSection() {
  const { state, saveOMSource, testGit, syncOM } = usePlatform();
  const wb = useWorkbench();
  const form = useSettingsForm(state.omSource, saveOMSource);
  const [testing, setTesting] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const { omSync } = state;
  const syncing = omSync.lastAttempt?.status === 'accepted';
  const failed = omSync.lastAttempt?.status === 'failed';
  const running = wb.state.executions.filter((e) => !e.ended);

  const test = async () => {
    setTesting(true);
    await testGit();
    setTesting(false);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" component="h2">Git 连接（本实例唯一 OM 仓库）</Typography>
      <Typography variant="body2" color="text.secondary">
        每个实例只配置一个 OM 仓库与来源分支，所有 Project 和执行共用。平台只同步文件与提交，不做语义索引；新执行启动前确认来源分支最新提交并固定 SHA。
      </Typography>
      <FormControl size="small">
        <InputLabel id="git-host">托管平台</InputLabel>
        <Select labelId="git-host" label="托管平台" value={form.value.hostType} onChange={(e) => form.set({ hostType: e.target.value })}>
          <MenuItem value="GitHub（演示）">GitHub（演示）</MenuItem>
          <MenuItem value="GitLab（演示）">GitLab（演示）</MenuItem>
        </Select>
      </FormControl>
      <TextField label="仓库" value={form.value.repo} onChange={(e) => form.set({ repo: e.target.value })} helperText="组织/仓库" />
      <TextField label="仓库 URL" value={form.value.repoUrl} onChange={(e) => form.set({ repoUrl: e.target.value })} />
      <TextField label="来源分支" value={form.value.branch} onChange={(e) => form.set({ branch: e.target.value })} helperText="默认分支策略 TBD；分支变化只影响未来新执行" />
      <TextField label="凭据引用" value={form.value.credentialRef} onChange={(e) => form.set({ credentialRef: e.target.value })} helperText="仅填写引用，不在此保存秘密值" />
      <SettingsActions
        dirty={form.dirty}
        result={form.result}
        onSave={form.save}
        onRevert={form.revert}
        extra={
        <>
            <Button variant="outlined" onClick={test} disabled={testing} startIcon={testing ? <CircularProgress size={14} /> : undefined}>
              {testing ? '测试中…' : '测试只读连接'}
            </Button>
            <Button color="error" onClick={() => setDisconnectOpen(true)}>断开连接</Button>
          </>
        } />
      
      <ConnectionTestResult result={state.gitTest} />

      <Box>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            同步 · 最新确认 <Box component="span" sx={{ fontFamily: 'monospace' }}>{shortSha(omSync.latestConfirmedSha)}</Box> · 最后成功 {formatTime(omSync.lastSuccessAt)}
          </Typography>
          <Chip variant="outlined" color={syncing ? 'info' : failed ? 'warning' : 'success'} label={syncing ? '同步中' : failed ? '最新未确认' : '已确认'} />
          <Button
            variant="outlined"
            disabled={form.dirty || syncing}
            startIcon={syncing ? <CircularProgress size={14} /> : undefined}
            onClick={() => setSyncMsg(syncOM().message)}>
            
            {failed ? '重试同步' : '同步'}
          </Button>
          <Button component={RouterLink} to="/om">查看文件</Button>
        </Stack>
        {form.dirty && <Typography variant="caption" color="text.secondary">请先保存连接设置再同步。</Typography>}
        {syncMsg && <Alert severity="info" sx={{ mb: 1 }} onClose={() => setSyncMsg(null)}>{syncMsg}</Alert>}
        {failed &&
        <Alert severity="warning" sx={{ mb: 1 }}>
            {omSync.lastAttempt?.note} 历史修订仍可阅读；新执行将保持未启动，直至确认来源。现有执行的 SHA 不变。同步频率、重试退避与时限 TBD。
          </Alert>
        }
        <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow><TableCell>时间</TableCell><TableCell>结果</TableCell><TableCell>提交</TableCell><TableCell>说明</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {state.syncRecords.map((r) =>
              <TableRow key={r.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatTime(r.at)}</TableCell>
                  <TableCell><Chip variant="outlined" color={r.status === '成功' ? 'success' : r.status === '失败' ? 'error' : 'info'} label={r.status} /></TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.sha ? shortSha(r.sha) : '—'}</TableCell>
                  <TableCell>{r.note}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </Box>

      <Dialog open={disconnectOpen} onClose={() => setDisconnectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>断开 Git 连接</DialogTitle>
        <DialogContent dividers>
          <Typography variant="subtitle2">依赖与运行中影响</Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1.5 }}>
            <Typography component="li" variant="body2">OM 文件浏览、提交历史与差异</Typography>
            <Typography component="li" variant="body2">新执行启动前的最新提交确认</Typography>
            {running.map((e) => <Typography component="li" variant="body2" key={e.id}>运行中执行 {e.id} 固定使用 {e.omCommit}</Typography>)}
          </Box>
          <Alert severity="error">影响检查尚未实现，无法确定对运行中执行的影响。操作已阻止，不会通过设置静默停止任务或切换执行版本。</Alert>
        </DialogContent>
        <DialogActions><Button onClick={() => setDisconnectOpen(false)}>返回</Button></DialogActions>
      </Dialog>
      <UnsavedChangesDialog blocker={form.blocker} onSave={() => form.save().ok} onDiscard={form.revert} />
    </Stack>);

}