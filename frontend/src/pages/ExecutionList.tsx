import { Box,Typography } from '@mui/material';
import { ExecutionBrowser } from '../components/lists/ExecutionBrowser';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { getVisibleExecutions } from '../utils/selectors';

export function ExecutionList() {
  const { state, currentUser } = useWorkbench();
  const executions = getVisibleExecutions(state.executions, currentUser);

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">
          全部执行
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          跨项目查看你有权查看的执行。点击待决数量可直接进入首个可处理请求。
        </Typography>
      </Box>
      <ExecutionBrowser executions={executions} showProject />
    </Box>);

}
