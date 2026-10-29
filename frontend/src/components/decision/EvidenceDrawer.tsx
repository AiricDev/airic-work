import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, AlertTitle, Box, Button, Chip, Divider, Drawer, IconButton, Skeleton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { evidence } from '../../data/evidence';
import { useWorkbench } from '../../contexts/WorkbenchContext';

interface EvidenceDrawerProps {
  evidenceId: string | null;
  onClose: () => void;
}

export function EvidenceDrawer({ evidenceId, onClose }: EvidenceDrawerProps) {
  const { state } = useWorkbench();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const doc = evidence.find((d) => d.id === evidenceId);
  const unavailable = state.settings.evidenceUnavailable;

  useEffect(() => {
    if (!evidenceId) return;
    setStatus('loading');
    const t = window.setTimeout(() => setStatus(unavailable ? 'error' : 'ready'), 450);
    return () => window.clearTimeout(t);
  }, [evidenceId, attempt, unavailable]);

  return (
    <Drawer anchor="right" open={Boolean(evidenceId)} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>
      {doc &&
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }} role="region" aria-label="证据详情">
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {doc.system}
                </Typography>
                <Typography variant="subtitle1" component="h2">
                  {doc.title}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }} useFlexGap flexWrap="wrap">
                  <Chip variant="outlined" label={`对象 ${doc.objectId}`} />
                  <Chip variant="outlined" label={`版本 ${doc.version}`} />
                  <Chip variant="outlined" label={doc.locator} />
                </Stack>
              </Box>
              <IconButton aria-label="关闭证据" onClick={onClose}>
                <CloseIcon />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ p: 2, flex: 1, overflow: 'auto' }}>
            {status === 'loading' &&
          <Stack spacing={1}>
                <Skeleton width="40%" />
                <Skeleton variant="rectangular" height={96} />
                <Skeleton width="60%" />
              </Stack>
          }
            {status === 'error' &&
          <Alert
            severity="error"
            action={
            <Button color="inherit" startIcon={<RefreshIcon />} onClick={() => setAttempt((a) => a + 1)}>
                    重试
                  </Button>
            }>
            
                <AlertTitle>来源存在，但当前无法核验</AlertTitle>
                业务系统未返回原文（模拟）。不以 Agent 摘要替代已查证原文；可重试或在业务系统中查看。
              </Alert>
          }
            {status === 'ready' &&
          <Stack spacing={2}>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    原文片段 · 来自业务系统
                  </Typography>
                  <Box
                component="blockquote"
                sx={{ m: 0, mt: 0.5, p: 1.5, borderLeft: 3, borderColor: 'primary.main', bgcolor: 'action.hover', borderRadius: 0.5 }}>
                
                    <Typography variant="body2">{doc.excerpt}</Typography>
                  </Box>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Agent 摘要 · 非权威
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {doc.agentSummary}
                  </Typography>
                </Box>
              </Stack>
          }
          </Box>

          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button component={RouterLink} to={`/business?ref=${doc.objectId}`} variant="outlined" startIcon={<OpenInNewIcon />} fullWidth>
              在业务系统查看（演示路由，未连接真实系统）
            </Button>
          </Box>
        </Box>
      }
    </Drawer>);

}