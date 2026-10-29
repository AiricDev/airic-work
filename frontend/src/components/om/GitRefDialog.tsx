import React from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface GitRefDialogProps {
  open: boolean;
  repo: string;
  sha: string;
  path?: string;
  onClose: () => void;
}

export function GitRefDialog({ open, repo, sha, path, onClose }: GitRefDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Git 平台（演示）</DialogTitle>
      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          原型未连接真实 Git 平台，此处代替外链。文件编辑、PR/MR、Review、批准与合并都在 GitHub/GitLab 完成。
        </Alert>
        <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, '& dd': { m: 0 } }}>
          <Typography component="dt" variant="body2" color="text.secondary">仓库</Typography>
          <Typography component="dd" variant="body2" sx={{ fontFamily: 'monospace' }}>{repo}</Typography>
          <Typography component="dt" variant="body2" color="text.secondary">完整 SHA</Typography>
          <Typography component="dd" variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{sha}</Typography>
          {path &&
          <>
              <Typography component="dt" variant="body2" color="text.secondary">文件</Typography>
              <Typography component="dd" variant="body2" sx={{ fontFamily: 'monospace' }}>{path}</Typography>
            </>
          }
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>关闭</Button>
      </DialogActions>
    </Dialog>);

}