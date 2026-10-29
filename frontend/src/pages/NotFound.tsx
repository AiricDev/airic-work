import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Paper, Typography } from '@mui/material';

export function NotFound() {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 520, mx: 'auto', mt: 4 }}>
      <Typography variant="h6">页面不存在</Typography>
      <Button component={RouterLink} to="/projects" variant="outlined" sx={{ mt: 2 }}>
        返回项目列表
      </Button>
    </Paper>);

}