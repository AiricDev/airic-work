import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Button, Paper, Stack, Typography } from '@mui/material';

export function RemovedFeature() {
  return (
    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
      <Typography variant="h6">该功能已移除</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        学习中心、分析任务与独立 Decision 知识页面不再由平台提供。实践记录可在执行轨迹与 Episode 中查看，并经授权由外部 Agent 只读读取；OM 以文件与 Git 历史形式浏览。
      </Typography>
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2 }}>
        <Button component={RouterLink} to="/om" variant="outlined">浏览 OM 文件</Button>
        <Button component={RouterLink} to="/guide">方法与接入指南</Button>
      </Stack>
    </Paper>);

}