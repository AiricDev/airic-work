import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography } from
'@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import HistoryIcon from '@mui/icons-material/History';
import { usePlatform } from '../contexts/PlatformContext';
import { PageHeader } from '../components/PageHeader';
import { OMSourceSummary } from '../components/om/OMSourceSummary';
import { FileTree } from '../components/om/FileTree';
import { MarkdownView } from '../components/om/MarkdownView';
import { GitRefDialog } from '../components/om/GitRefDialog';
import { findCommit, isSafePath, isSynced, searchSnapshot, shortSha, snapshotAt } from '../utils/omRepository';
import { formatTime } from '../utils/time';

const DEFAULT_PATH = 'README.md';

function HighlightLine({ text, q }: {text: string;q: string;}) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || !q) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <Box component="mark" sx={{ bgcolor: 'warning.light', color: 'inherit', px: 0.25 }}>{text.slice(i, i + q.length)}</Box>
      {text.slice(i + q.length)}
    </>);

}

export function OMBrowser() {
  const { state, isAdmin } = usePlatform();
  const [params, setParams] = useSearchParams();
  const [gitOpen, setGitOpen] = useState(false);
  const q = params.get('q') ?? '';
  const [query, setQuery] = useState(q);
  useEffect(() => setQuery(q), [q]);

  if (!state.omSource.repo.trim()) {
    return (
      <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
        <PageHeader title="Operating Model" description="本实例唯一配置的 OM 仓库。" />
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6">尚未配置 OM 仓库</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {isAdmin ? '请前往系统设置配置仓库与来源分支，并完成同步。' : '请联系管理员配置本实例的 OM 仓库。'}
          </Typography>
          {isAdmin && <Button component={RouterLink} to="/settings/system/git" variant="contained" sx={{ mt: 2 }}>前往 Git 设置</Button>}
        </Paper>
      </Box>);

  }

  const confirmed = state.omSync.latestConfirmedSha;
  const commitParam = params.get('commit');
  const requested = commitParam ? findCommit(commitParam) : undefined;
  const commitUnavailable = Boolean(commitParam) && (!requested || !isSynced(requested.sha, confirmed));
  const sha = requested && !commitUnavailable ? requested.sha : confirmed;
  const commit = findCommit(sha)!;
  const historical = sha !== confirmed;
  const snapshot = snapshotAt(sha);
  const paths = Array.from(snapshot.keys());
  const binaryPaths = new Set(paths.filter((p) => snapshot.get(p)?.binary));
  const rawPath = params.get('path') ?? DEFAULT_PATH;
  const unsafe = !isSafePath(rawPath);
  const file = unsafe ? undefined : snapshot.get(rawPath);
  const results = q ? searchSnapshot(sha, q) : [];

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => v ? next.set(k, v) : next.delete(k));
    setParams(next);
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader title="Operating Model" description="OM 是一组 Git 文件。此处只读浏览目录、正文与历史；编辑、Review 与合并在 Git 平台完成。" />
      <OMSourceSummary />

      {commitUnavailable &&
      <Alert severity="warning" sx={{ mb: 2 }}>
          修订 {commitParam} 不存在或尚未同步，以下显示最新确认修订。
        </Alert>
      }
      {historical &&
      <Alert
        severity="info"
        sx={{ mb: 2 }}
        action={<Button color="inherit" onClick={() => update({ commit: null })}>回到最新确认</Button>}>
        
          历史视图：<Box component="span" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{commit.sha}</Box> · {formatTime(commit.at)} · {commit.message.split('\n')[0]}
        </Alert>
      }

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '300px minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
        <Paper variant="outlined" sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
          <Box component="form" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }} onSubmit={(e) => {e.preventDefault();update({ q: query.trim() || null });}}>
            <TextField
              fullWidth
              size="small"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="全文搜索当前修订"
              inputProps={{ 'aria-label': '全文搜索当前修订' }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: q ?
                <InputAdornment position="end">
                    <IconButton size="small" aria-label="清除搜索" onClick={() => update({ q: null })}><CloseIcon fontSize="small" /></IconButton>
                  </InputAdornment> :
                undefined
              }} />
            
            <Typography variant="caption" color="text.secondary">基于 {shortSha(sha)} 快照的文本匹配，不做语义索引。</Typography>
          </Box>
          <Box sx={{ maxHeight: { md: 'calc(100vh - 260px)' }, overflow: 'auto', py: 0.5 }}>
            {q ?
            results.length === 0 ?
            <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>没有匹配“{q}”的文件。</Typography> :

            <List dense disablePadding aria-label="搜索结果">
                  {results.map((r) =>
              <ListItemButton key={r.path} selected={r.path === rawPath} onClick={() => update({ path: r.path })} sx={{ alignItems: 'flex-start' }}>
                      <ListItemText
                  primary={<Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.path} · {r.count} 处</Typography>}
                  secondary={r.lines.map((l) =>
                  <Box component="span" key={l.no} sx={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {l.no}: <HighlightLine text={l.text} q={q} />
                          </Box>
                  )}
                  secondaryTypographyProps={{ component: 'div' }} />
                
                    </ListItemButton>
              )}
                </List> :


            <FileTree paths={paths} selected={rawPath} binaryPaths={binaryPaths} onSelect={(p) => update({ path: p })} />
            }
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }} useFlexGap flexWrap="wrap">
            <Typography variant="body2" sx={{ fontFamily: 'monospace', flex: 1, minWidth: 0, wordBreak: 'break-all' }}>{rawPath}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>@ {shortSha(sha)}</Typography>
            <Button size="small" component={RouterLink} to="/om/history" startIcon={<HistoryIcon />}>历史</Button>
            <Button size="small" onClick={() => setGitOpen(true)}>在 Git 编辑</Button>
          </Stack>
          <Box sx={{ p: 3 }}>
            {unsafe ?
            <Alert severity="error">路径不合法或越出仓库范围，已拒绝读取。</Alert> :
            !file ?
            <Alert severity="warning">
                该修订中不存在文件 {rawPath}。<Link component="button" onClick={() => update({ path: DEFAULT_PATH })} sx={{ ml: 0.5 }}>打开 README</Link>
              </Alert> :
            file.binary ?
            <Stack spacing={1.5}>
                <Alert severity="info">二进制或不支持预览的格式，仅显示文件元信息。</Alert>
                <Typography variant="body2">类型：{file.binary.mime} · 大小：{file.binary.size}</Typography>
                <Box><Button variant="outlined" onClick={() => setGitOpen(true)}>在 Git 平台查看</Button></Box>
              </Stack> :
            rawPath.endsWith('.md') ?
            <MarkdownView content={file.content ?? ''} path={rawPath} sha={sha} highlight={q} /> :

            <Box component="pre" sx={{ m: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>{file.content}</Box>
            }
          </Box>
        </Paper>
      </Box>
      <GitRefDialog open={gitOpen} repo={state.omSource.repo} sha={sha} path={rawPath} onClose={() => setGitOpen(false)} />
    </Box>);

}