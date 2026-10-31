import BlockIcon from '@mui/icons-material/Block';
import { Button,Paper,Typography } from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { usePlatform } from '../../contexts/PlatformContext';

export function RequireAdmin({ children }: {children: React.ReactNode;}) {
  const { isAdmin, account } = usePlatform();
  if (isAdmin) return <>{children}</>;
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
      <BlockIcon color="action" sx={{ fontSize: 40 }} />
      <Typography variant="h6" sx={{ mt: 1 }}>无权访问（403）</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        系统设置与用户管理仅管理员可用。当前身份：{account.name}（{account.systemRole === 'admin' ? '管理员' : '成员'}）。
      </Typography>
      <Button component={RouterLink} to="/projects" variant="outlined" sx={{ mt: 2 }}>返回项目列表</Button>
    </Paper>);

}
