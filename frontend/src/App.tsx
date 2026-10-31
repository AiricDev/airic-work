import { CssBaseline,ThemeProvider } from '@mui/material';
import { createBrowserRouter,Navigate,RouterProvider } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { RequireAdmin } from './components/layout/RequireAdmin';
import { PlatformProvider } from './contexts/PlatformContext';
import { WorkbenchProvider } from './contexts/WorkbenchContext';
import { DecisionList } from './pages/DecisionList';
import { EpisodeDetail } from './pages/EpisodeDetail';
import { ExecutionList } from './pages/ExecutionList';
import { ExecutionWorkspace } from './pages/ExecutionWorkspace';
import { Guide } from './pages/Guide';
import { Login } from './pages/Login';
import { MockBusinessSystem } from './pages/MockBusinessSystem';
import { NotFound } from './pages/NotFound';
import { OMBrowser } from './pages/OMBrowser';
import { OMCommitDetail } from './pages/OMCommitDetail';
import { OMHistory } from './pages/OMHistory';
import { ProfileSettings } from './pages/ProfileSettings';
import { ProjectList } from './pages/ProjectList';
import { ProjectWorkspace } from './pages/ProjectWorkspace';
import { RemovedFeature } from './pages/RemovedFeature';
import { SystemSettings } from './pages/SystemSettings';
import { Trajectory } from './pages/Trajectory';
import { UserDetail } from './pages/UserDetail';
import { UserManagement } from './pages/UserManagement';
import { theme } from './utils/theme';

const router = createBrowserRouter([
{ path: '/login', element: <Login /> },
{
  path: '/',
  element: <AppShell />,
  children: [
  { index: true, element: <Navigate to="/projects" replace /> },
  { path: 'projects', element: <ProjectList /> },
  { path: 'projects/:projectId', element: <ProjectWorkspace /> },
  { path: 'executions', element: <ExecutionList /> },
  { path: 'executions/:executionId', element: <ExecutionWorkspace /> },
  { path: 'executions/:executionId/trajectory', element: <Trajectory /> },
  { path: 'episodes/:episodeId', element: <EpisodeDetail /> },
  { path: 'decisions', element: <DecisionList /> },
  { path: 'om', element: <OMBrowser /> },
  { path: 'om/history', element: <OMHistory /> },
  { path: 'om/commits/:sha', element: <OMCommitDetail /> },
  { path: 'oms', element: <Navigate to="/om" replace /> },
  { path: 'oms/:omId', element: <Navigate to="/om" replace /> },
  { path: 'oms/:omId/decisions/:decisionId', element: <RemovedFeature /> },
  { path: 'learning', element: <RemovedFeature /> },
  { path: 'learning/:findingId', element: <RemovedFeature /> },
  { path: 'analyses/:analysisId', element: <RemovedFeature /> },
  { path: 'guide', element: <Guide /> },
  { path: 'settings/system', element: <Navigate to="/settings/system/general" replace /> },
  { path: 'settings/system/:section', element: <RequireAdmin><SystemSettings /></RequireAdmin> },
  { path: 'settings/users', element: <RequireAdmin><UserManagement /></RequireAdmin> },
  { path: 'settings/users/:userId', element: <RequireAdmin><UserDetail /></RequireAdmin> },
  { path: 'settings/profile', element: <ProfileSettings /> },
  { path: 'business', element: <MockBusinessSystem /> },
  { path: '*', element: <NotFound /> }]

}]
);

export function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WorkbenchProvider>
        <PlatformProvider>
          <RouterProvider router={router} />
        </PlatformProvider>
      </WorkbenchProvider>
    </ThemeProvider>);

}
