import React, { useEffect, useState } from 'react';
import { Box, Chip, IconButton, List, ListItemButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import type { DecisionRequest } from '../../types/workbench';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { requestKindLabels } from '../../utils/labels';
import { duration, formatTime } from '../../utils/time';
import { userName } from '../../utils/decisionService';

interface DecisionQueueProps {
  requests: DecisionRequest[];
  activeId: string | null;
  onSelect: (id: string) => void;
}

export function DecisionQueue({ requests, activeId, onSelect }: DecisionQueueProps) {
  const { currentUser, drafts } = useWorkbench();
  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status === 'resolved');
  const active = requests.find((r) => r.id === activeId);
  const [tab, setTab] = useState<'pending' | 'resolved'>(active?.status === 'resolved' ? 'resolved' : 'pending');
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (active) setTab(active.status === 'resolved' && !pending.some((r) => r.id === active.id) ? 'resolved' : 'pending');
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = tab === 'pending' ? pending : resolved;

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
        <Typography variant="subtitle1" component="h2" sx={{ flex: 1 }}>
          待决事项 {pending.length}
        </Typography>
        <Tooltip title={collapsed ? '展开队列' : '收起队列，增加阅读空间'}>
          <IconButton aria-label={collapsed ? '展开队列' : '收起队列'} aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <UnfoldMoreIcon fontSize="small" /> : <UnfoldLessIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Stack>

      {collapsed ?
      <Typography variant="body2" color="text.secondary" noWrap sx={{ px: 2, pb: 1.5 }}>
          当前：{active ? active.question : '未选择请求'}
        </Typography> :

      <>
          <Tabs value={tab} onChange={(_, v: 'pending' | 'resolved') => setTab(v)} sx={{ px: 1, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}>
            <Tab value="pending" label={`待处理 (${pending.length})`} />
            <Tab value="resolved" label={`已处理 (${resolved.length})`} />
          </Tabs>
          {list.length === 0 ?
        <Box sx={{ px: 2, py: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {tab === 'pending' ? '不需要你处理' : '暂无已处理记录'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {tab === 'pending' ? '当前执行没有待决事项，仍可查看进展与已处理记录。' : '处理后的请求会出现在这里。'}
              </Typography>
            </Box> :

        <List dense sx={{ px: 1, pb: 1, maxHeight: 260, overflow: 'auto' }}>
              {list.map((r) => {
            const selected = r.id === activeId;
            const hasDraft = r.status === 'pending' && Boolean(drafts[r.id]);
            return (
              <ListItemButton
                key={r.id}
                selected={selected}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(r.id)}
                sx={{ borderRadius: 1, mb: 0.5, border: 1, borderColor: selected ? 'primary.main' : 'divider', display: 'block', py: 1 }}>
                
                    <Typography
                  variant="body2"
                  fontWeight={selected ? 600 : 500}
                  sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  
                      {r.question}
                    </Typography>
                    <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
                      <Chip variant="outlined" label={requestKindLabels[r.kind]} />
                      {r.ownerId !== currentUser.id && <Chip variant="outlined" label={`归属 ${userName(r.ownerId)}`} />}
                      {hasDraft && <Chip variant="outlined" color="info" icon={<EditNoteOutlinedIcon />} label="有草稿" />}
                      <Typography variant="caption" color="text.secondary">
                        {r.status === 'pending' ? `已等待 ${duration(r.createdAt)}` : `${r.resolution?.actorName} · ${r.resolution ? formatTime(r.resolution.at) : ''}`}
                      </Typography>
                    </Stack>
                  </ListItemButton>);

          })}
            </List>
        }
        </>
      }
    </Box>);

}