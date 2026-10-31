import { Box,List,ListItemButton,ListItemText,Paper } from '@mui/material';
import { Navigate,Link as RouterLink,useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { BusinessSection } from '../components/settings/BusinessSection';
import { GeneralSection } from '../components/settings/GeneralSection';
import { GitSection } from '../components/settings/GitSection';
import { RuntimeSection } from '../components/settings/RuntimeSection';
import { TrajectoryMcpSection } from '../components/settings/TrajectoryMcpSection';

const sections = [
{ id: 'general', label: '基本信息' },
{ id: 'git', label: 'Git 连接' },
{ id: 'business', label: '业务连接与 API' },
{ id: 'trajectory-mcp', label: '只读轨迹 MCP' },
{ id: 'runtime', label: 'Runtime 与 Skills' },
{ id: 'data', label: '数据与安全' }];


export function SystemSettings() {
  const { section } = useParams();
  if (!sections.some((s) => s.id === section)) return <Navigate to="/settings/system/general" replace />;

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader title="系统设置" description="每个分区独立保存。Git、业务 MCP、标准 API 与只读轨迹 MCP 分开配置；测试、保存与实际生效相互分开，不会静默改变运行中执行的身份、SHA 或权限。" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px minmax(0, 960px)' }, gap: 2, alignItems: 'start' }}>
        <Paper variant="outlined">
          <List dense component="nav" aria-label="设置分区">
            {sections.map((s) =>
            <ListItemButton key={s.id} component={RouterLink} to={`/settings/system/${s.id}`} selected={s.id === section} aria-current={s.id === section ? 'page' : undefined}>
                <ListItemText primary={s.label} />
              </ListItemButton>
            )}
          </List>
        </Paper>
        <Paper variant="outlined" sx={{ p: 3 }}>
          {section === 'general' && <GeneralSection />}
          {section === 'git' && <GitSection />}
          {section === 'business' && <BusinessSection />}
          {section === 'trajectory-mcp' && <TrajectoryMcpSection />}
          {section === 'runtime' && <RuntimeSection mode="runtime" />}
          {section === 'data' && <RuntimeSection mode="data" />}

        </Paper>
      </Box>
    </Box>);

}
