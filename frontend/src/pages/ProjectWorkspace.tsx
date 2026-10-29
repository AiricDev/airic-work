import React from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { Box, Breadcrumbs, Button, Chip, Link, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { getVisibleExecutions, getVisibleProjects, getVisibleRequests } from '../utils/selectors';
import { ExecutionBrowser } from '../components/lists/ExecutionBrowser';
import { DecisionBrowser } from '../components/lists/DecisionBrowser';

export function ProjectWorkspace() {
  const { projectId } = useParams();
  const [params, setParams] = useSearchParams();
  const { state, currentUser } = useWorkbench();
  const project = getVisibleProjects(currentUser).find((p) => p.id === projectId);

  if (!project) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
        <Typography variant="h6">项目不存在或你无权查看</Typography>
        <Button component={RouterLink} to="/projects" sx={{ mt: 2 }} variant="outlined">
          返回项目列表
        </Button>
      </Paper>);

  }

  const executions = getVisibleExecutions(state.executions, currentUser).filter((e) => e.projectId === project.id);
  const execIds = new Set(executions.map((e) => e.id));
  const requests = getVisibleRequests(state.requests, state.executions, currentUser).filter((r) => execIds.has(r.executionId));
  const myPending = requests.filter((r) => r.status === 'pending' && r.ownerId === currentUser.id).length;
  const tab = params.get('tab') === 'decisions' ? 'decisions' : 'executions';

  const switchTab = (v: string) => {
    const next = new URLSearchParams();
    if (v === 'decisions') next.set('tab', 'decisions');
    setParams(next, { replace: true });
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Breadcrumbs aria-label="位置">
          <Link component={RouterLink} to="/projects" underline="hover" color="inherit">
            项目
          </Link>
          <Typography color="text.primary">{project.name}</Typography>
        </Breadcrumbs>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mt: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h1">
              {project.name}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
              <Chip variant="outlined" label={`业务引用 ${project.businessRef}`} />
              <Typography variant="body2" color="text.secondary">
                {project.sourceSystem} · {project.businessTaskRef}
              </Typography>
            </Stack>
          </Box>
          <Button component={RouterLink} to={`/business?ref=${project.businessRef}`} variant="outlined" startIcon={<OpenInNewIcon />}>
            返回业务系统
          </Button>
        </Stack>
      </Paper>

      <Tabs value={tab} onChange={(_, v: string) => switchTab(v)} sx={{ mb: 1.5 }}>
        <Tab value="executions" label={`执行 (${executions.length})`} />
        <Tab value="decisions" label={`待决事项${myPending ? ` (${myPending})` : ''}`} />
      </Tabs>

      {tab === 'executions' ? <ExecutionBrowser executions={executions} /> : <DecisionBrowser requests={requests} showProject={false} />}
    </Box>);

}