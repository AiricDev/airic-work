import { Box,Typography } from '@mui/material';
import { DecisionBrowser } from '../components/lists/DecisionBrowser';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { getVisibleRequests } from '../utils/selectors';

export function DecisionList() {
  const { state, currentUser } = useWorkbench();
  const requests = getVisibleRequests(state.requests, state.executions, currentUser);

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">
          待决事项
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          跨执行集中查看请求。点击后进入对应执行并定位该请求，在执行上下文中处理。
        </Typography>
      </Box>
      <DecisionBrowser requests={requests} />
    </Box>);

}
