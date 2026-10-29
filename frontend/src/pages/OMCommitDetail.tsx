import React, { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Breadcrumbs, Button, Chip, Link, Paper, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { usePlatform } from '../contexts/PlatformContext';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { PageHeader } from '../components/PageHeader';
import { OMSourceSummary } from '../components/om/OMSourceSummary';
import { DiffView } from '../components/om/DiffView';
import { GitRefDialog } from '../components/om/GitRefDialog';
import { findCommit, isSynced, omFileLink, parentContent, shortSha } from '../utils/omRepository';
import { formatTime } from '../utils/time';

const statusLabel = { added: '新增', modified: '修改', deleted: '删除' } as const;
const statusColor = { added: 'success', modified: 'info', deleted: 'error' } as const;

export function OMCommitDetail() {
  const { sha: ref } = useParams();
  const { state } = usePlatform();
  const wb = useWorkbench();
  const [gitPath, setGitPath] = useState<string | null>(null);
  const commit = findCommit(ref);

  if (!commit || !isSynced(commit.sha, state.omSync.latestConfirmedSha)) {
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        <PageHeader title="Operating Model" />
        <OMSourceSummary />
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">提交不存在或尚未同步</Typography>
          <Button component={RouterLink} to="/om/history" variant="outlined" sx={{ mt: 2 }}>返回提交历史</Button>
        </Paper>
      </Box>);

  }

  const execs = wb.state.executions.filter((e) => commit.sha.startsWith(e.omCommit));

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader title="Operating Model" />
      <OMSourceSummary />
      <Breadcrumbs aria-label="位置" sx={{ mb: 1 }}>
        <Link component={RouterLink} to="/om/history" underline="hover" color="inherit">提交历史</Link>
        <Typography color="text.primary" sx={{ fontFamily: 'monospace' }}>{shortSha(commit.sha)}</Typography>
      </Breadcrumbs>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" component="h2">{commit.message.split('\n')[0]}</Typography>
        {commit.message.includes('\n') &&
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>
            {commit.message.split('\n').slice(1).join('\n').trim()}
          </Typography>
        }
        <Box component="dl" sx={{ m: 0, mt: 1.5, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.5, '& dd': { m: 0 } }}>
          <Typography component="dt" variant="body2" color="text.secondary">完整 SHA</Typography>
          <Typography component="dd" variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{commit.sha}</Typography>
          <Typography component="dt" variant="body2" color="text.secondary">父提交</Typography>
          <Typography component="dd" variant="body2" sx={{ fontFamily: 'monospace' }}>
            {commit.parents.length === 0 ? '无（初始提交）' : commit.parents.map((p) => <Link key={p} component={RouterLink} to={`/om/commits/${p}`}>{shortSha(p)}</Link>)}
          </Typography>
          <Typography component="dt" variant="body2" color="text.secondary">作者 / 时间</Typography>
          <Typography component="dd" variant="body2">{commit.author} · {formatTime(commit.at)}</Typography>
          <Typography component="dt" variant="body2" color="text.secondary">执行使用</Typography>
          <Typography component="dd" variant="body2">
            {execs.length === 0 ? '无执行固定在此修订' : execs.map((e, i) =>
            <React.Fragment key={e.id}>
                {i > 0 && '、'}
                <Link component={RouterLink} to={`/executions/${e.id}`}>{e.id}</Link>
              </React.Fragment>
            )}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button component={RouterLink} to={`/om?commit=${shortSha(commit.sha)}`} variant="outlined">以此修订浏览文件</Button>
        </Stack>
      </Paper>

      <Typography variant="subtitle1" component="h2" sx={{ mb: 1 }}>变更文件（{commit.changes.length}）</Typography>
      <Stack spacing={1}>
        {commit.changes.map((ch) =>
        <Accordion key={ch.path} variant="outlined" defaultExpanded={commit.changes.length <= 3} disableGutters sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                <Chip variant="outlined" color={statusColor[ch.status]} label={statusLabel[ch.status]} sx={{ height: 22 }} />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{ch.path}</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              {ch.binary ?
            <Stack spacing={1}>
                  <Alert severity="info">二进制文件（{ch.binary.mime}，{ch.binary.size}），不生成差异预览。</Alert>
                  <Box><Button size="small" variant="outlined" onClick={() => setGitPath(ch.path)}>在 Git 平台查看</Button></Box>
                </Stack> :

            <Stack spacing={1}>
                  <DiffView before={parentContent(commit, ch.path) ?? ''} after={ch.status === 'deleted' ? '' : ch.content ?? ''} />
                  {ch.status !== 'deleted' &&
              <Box><Link component={RouterLink} to={omFileLink(commit.sha, ch.path)} variant="body2">查看此修订中的完整文件</Link></Box>
              }
                </Stack>
            }
            </AccordionDetails>
          </Accordion>
        )}
      </Stack>
      <GitRefDialog open={Boolean(gitPath)} repo={state.omSource.repo} sha={commit.sha} path={gitPath ?? undefined} onClose={() => setGitPath(null)} />
    </Box>);

}