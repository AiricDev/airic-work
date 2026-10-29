import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Divider, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { DecisionRequest } from '../../types/workbench';
import type { ContextDependency } from '../../types/platform';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { fileAt, findCommit, omFileLink, shortSha } from '../../utils/omRepository';
import { dependencyStatusColor } from '../../utils/contextDependencies';
import { formatTime } from '../../utils/time';

interface ContextDependencyDrawerProps {
  dependency: ContextDependency | null;
  request: DecisionRequest;
  onClose: () => void;
}

export function ContextDependencyDrawer({ dependency, request, onClose }: ContextDependencyDrawerProps) {
  const { state } = useWorkbench();
  const platform = usePlatform();
  const commit = findCommit(request.brief.omCommit);

  const body = () => {
    if (!dependency) return null;
    if (dependency.kind === '规则' && dependency.omPath) {
      const file = commit ? fileAt(commit.sha, dependency.omPath) : undefined;
      if (!commit || !file?.content) {
        return <Alert severity="warning">无法在执行固定版本 {request.brief.omCommit} 中读取该文件（缺版本或文件不存在）。不以摘要替代原文。</Alert>;
      }
      return (
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            以下为执行固定修订中的文件原文（前 20 行）。仓库后续修改不会改变本次执行依据。
          </Typography>
          <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'grey.50', border: 1, borderColor: 'divider', borderRadius: 1, fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto' }}>
            {file.content.split('\n').slice(0, 20).join('\n')}
          </Box>
          <Box>
            <Button component={RouterLink} to={omFileLink(commit.sha, dependency.omPath)} variant="outlined">
              在 OM 文件中阅读（@ {shortSha(commit.sha)}）
            </Button>
          </Box>
        </Stack>);

    }
    if (dependency.kind === '既往决定' && dependency.priorRequestId) {
      const prior = state.requests.find((r) => r.id === dependency.priorRequestId);
      if (!prior?.resolution) return <Alert severity="info">尚无正式处理记录。</Alert>;
      const r = prior.resolution;
      return (
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, '& dd': { m: 0 } }}>
          <Typography component="dt" variant="body2" color="text.secondary">请求</Typography>
          <Typography component="dd" variant="body2">{prior.id} · {prior.question}</Typography>
          <Typography component="dt" variant="body2" color="text.secondary">正式记录</Typography>
          <Typography component="dd" variant="body2">{r.content}</Typography>
          {r.source &&
          <>
              <Typography component="dt" variant="body2" color="text.secondary">来源</Typography>
              <Typography component="dd" variant="body2">{r.source}</Typography>
            </>
          }
          <Typography component="dt" variant="body2" color="text.secondary">处理人</Typography>
          <Typography component="dd" variant="body2">{r.actorName}（{r.channel}）· {formatTime(r.at)}</Typography>
        </Box>);

    }
    if (dependency.kind === '授权' && dependency.delegationSystem) {
      const dg = platform.state.delegations.find((d) => d.userId === request.ownerId && d.system === dependency.delegationSystem);
      if (!dg) return <Alert severity="warning">归属人尚未建立该业务系统的委托。</Alert>;
      return (
        <Stack spacing={1.5}>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, '& dd': { m: 0 } }}>
            <Typography component="dt" variant="body2" color="text.secondary">适用范围</Typography>
            <Typography component="dd" variant="body2">{dg.scope}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">当前有效性</Typography>
            <Typography component="dd" variant="body2">{dg.status}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">到期</Typography>
            <Typography component="dd" variant="body2">{dg.expiresAt ? formatTime(dg.expiresAt) : '未知'}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">最近校验</Typography>
            <Typography component="dd" variant="body2">{formatTime(dg.lastVerifiedAt)}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">Decision 中的同意不会创建业务委托；委托有效也不等于目标业务操作有权。</Typography>
        </Stack>);

    }
    if (dependency.status === '无访问权') return <Alert severity="info">来源存在，但当前无可用访问能力或权限，无法核验。不以 Agent 摘要替代。</Alert>;
    if (dependency.status === '缺失') return <Alert severity="warning">该信息当前缺失。Agent 不推测其内容；受影响范围见上方说明。</Alert>;
    return <Typography variant="body2" color="text.secondary">暂无可展示的原文。</Typography>;
  };

  return (
    <Drawer anchor="right" open={Boolean(dependency)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 640 } } }}>
      {dependency &&
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack direction="row" alignItems="flex-start" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Decision Context · {dependency.kind}</Typography>
              <Typography variant="subtitle1" component="h2">{dependency.name}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} useFlexGap flexWrap="wrap">
                <Chip variant="outlined" color={dependencyStatusColor[dependency.status]} label={dependency.status} />
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                  {dependency.source}{dependency.version ? ` · ${dependency.version}` : ''}
                </Typography>
              </Stack>
            </Box>
            <IconButton aria-label="关闭 Context 详情" onClick={onClose}><CloseIcon /></IconButton>
          </Stack>
          <Stack spacing={2} sx={{ p: 2, overflow: 'auto' }}>
            <Box>
              <Typography variant="overline" color="text.secondary">影响</Typography>
              <Typography variant="body2">{dependency.impact}</Typography>
              {dependency.note && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{dependency.note}</Typography>}
            </Box>
            <Divider />
            {body()}
          </Stack>
        </Box>
      }
    </Drawer>);

}