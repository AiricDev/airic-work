import React, { useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { usePlatform } from '../../contexts/PlatformContext';
import { shortSha } from '../../utils/omRepository';
import { formatTime } from '../../utils/time';
import { GitRefDialog } from './GitRefDialog';

export function OMSourceSummary() {
  const { state, isAdmin, syncOM } = usePlatform();
  const location = useLocation();
  const [gitOpen, setGitOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const { omSource, omSync } = state;
  const attempt = omSync.lastAttempt;
  const syncing = attempt?.status === 'accepted';
  const failed = attempt?.status === 'failed';
  const tab = location.pathname.startsWith('/om/history') || location.pathname.startsWith('/om/commits') ? 'history' : 'files';

  return (
    <Paper variant="outlined" sx={{ mb: 2 }}>
      <Box sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary">本实例唯一 OM 来源</Typography>
            <Typography variant="h6" component="p" sx={{ fontFamily: 'monospace' }}>
              {omSource.repo}
            </Typography>
            <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5, color: 'text.secondary' }}>
              <Typography variant="caption">来源分支：{omSource.branch}</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                最新确认：{shortSha(omSync.latestConfirmedSha)}
              </Typography>
              <Typography variant="caption">最后成功同步：{formatTime(omSync.lastSuccessAt)}</Typography>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
            <Chip
              variant="outlined"
              color={syncing ? 'info' : failed ? 'warning' : 'success'}
              label={syncing ? '同步中' : failed ? '最新未确认' : '已确认最新（截至最后同步）'} />
            
            {isAdmin &&
            <Button
              variant="outlined"
              startIcon={syncing ? <CircularProgress size={14} /> : <SyncIcon />}
              disabled={syncing}
              onClick={() => setMsg(syncOM().message)}>
              
                {syncing ? '同步中…' : '同步'}
              </Button>
            }
            <Button startIcon={<OpenInNewIcon />} onClick={() => setGitOpen(true)}>在 Git 平台查看</Button>
          </Stack>
        </Stack>
        {failed &&
        <Alert severity="warning" sx={{ mt: 1.5 }}>
            {attempt?.note} 历史修订仍可阅读；新执行在确认来源前不会进入实际运行。
            {isAdmin ? '' : ' 如需处理，请联系管理员。'}
          </Alert>
        }
        {msg && !failed && <Alert severity="info" sx={{ mt: 1.5 }} onClose={() => setMsg(null)}>{msg}</Alert>}
      </Box>
      <Tabs value={tab} sx={{ px: 1, borderTop: 1, borderColor: 'divider' }}>
        <Tab value="files" label="文件" component={RouterLink} to="/om" />
        <Tab value="history" label="提交历史" component={RouterLink} to="/om/history" />
      </Tabs>
      <GitRefDialog open={gitOpen} repo={omSource.repo} sha={omSync.latestConfirmedSha} onClose={() => setGitOpen(false)} />
    </Paper>);

}