import React, { useMemo, useState } from 'react';
import { Link as RouterLink, Navigate, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Paper,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery } from
'@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { usePlatform } from '../../contexts/PlatformContext';
import { getVisibleProjects, getVisibleRequests } from '../../utils/selectors';
import { DemoConsole } from './DemoConsole';
import { NotificationMenu } from './NotificationMenu';

const drawerWidth = 240;
const appBarHeight = 64;

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  match?: string[];
}

const workItems: NavItem[] = [
{ to: '/projects', label: '项目', icon: <FolderOutlinedIcon fontSize="small" /> },
{ to: '/executions', label: '全部执行', icon: <PlayCircleOutlineIcon fontSize="small" /> },
{ to: '/decisions', label: '待决事项', icon: <InboxOutlinedIcon fontSize="small" /> }];

const knowledgeItems: NavItem[] = [
{ to: '/om', label: 'Operating Model', icon: <AccountTreeOutlinedIcon fontSize="small" /> }];

const adminItems: NavItem[] = [
{ to: '/settings/system', label: '系统设置', icon: <SettingsOutlinedIcon fontSize="small" /> },
{ to: '/settings/users', label: '用户管理', icon: <GroupOutlinedIcon fontSize="small" /> }];


export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [userAnchor, setUserAnchor] = useState<HTMLElement | null>(null);
  const { state, currentUser, updateSettings } = useWorkbench();
  const { state: platform, account, isAdmin, signOut } = usePlatform();
  const location = useLocation();
  const navigate = useNavigate();

  const visibleProjects = getVisibleProjects(currentUser);
  const myPending = getVisibleRequests(state.requests, state.executions, currentUser).filter(
    (r) => r.status === 'pending' && r.ownerId === currentUser.id
  ).length;

  const currentProject = useMemo(() => {
    const pm = location.pathname.match(/^\/projects\/([^/]+)/);
    const em = location.pathname.match(/^\/executions\/([^/]+)/);
    const id = pm ? pm[1] : em ? state.executions.find((e) => e.id === em[1])?.projectId : undefined;
    return visibleProjects.find((p) => p.id === id) ?? null;
  }, [location.pathname, state.executions, visibleProjects]);

  if (platform.signedOut) {
    return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  const accountDisabled = account.status !== 'active';

  const renderGroup = (title: string, items: NavItem[]) =>
  <List
    dense
    subheader={
    <ListSubheader component="div" sx={{ lineHeight: '32px', bgcolor: 'transparent' }}>
          {title}
        </ListSubheader>
    }>
    
      {items.map((item) => {
      const active = (item.match ?? [item.to]).some((m) => location.pathname.startsWith(m));
      return (
        <ListItemButton
          key={item.to}
          component={RouterLink}
          to={item.to}
          selected={active}
          aria-current={active ? 'page' : undefined}
          onClick={() => setMobileOpen(false)}
          sx={{ mx: 1, borderRadius: 1, mb: 0.25 }}>
          
            <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: active ? 600 : 400 }} />
            {item.to === '/decisions' && myPending > 0 &&
          <Chip label={myPending} color="warning" aria-label={`${myPending} 项需我处理`} sx={{ height: 20 }} />
          }
          </ListItemButton>);

    })}
    </List>;


  const drawer =
  <Box component="nav" aria-label="主导航" sx={{ py: 1 }}>
      {renderGroup('工作', workItems)}
      {renderGroup('知识', knowledgeItems)}
      {isAdmin && renderGroup('管理', adminItems)}
    </Box>;


  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default', width: '100%' }}>
      <ScrollRestoration />
      <AppBar
        position="fixed"
        elevation={0}
        sx={{ zIndex: theme.zIndex.drawer + 1, bgcolor: 'background.paper', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>
        
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56, sm: appBarHeight } }}>
          {!isDesktop &&
          <IconButton edge="start" aria-label="打开导航" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          }
          <Typography variant="subtitle1" component="span" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            Airic Work
          </Typography>
          <Chip label="演示数据" color="warning" variant="outlined" />
          <Box sx={{ flex: 1 }} />
          <Autocomplete
            size="small"
            sx={{ width: 240, display: { xs: 'none', md: 'block' } }}
            options={visibleProjects}
            value={currentProject}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, v) => {
              if (v) navigate(`/projects/${v.id}`);
            }}
            renderInput={(params) =>
            <TextField {...params} placeholder="切换项目" inputProps={{ ...params.inputProps, 'aria-label': '切换项目' }} />
            } />
          
          <Button startIcon={<TuneOutlinedIcon />} variant="outlined" color="inherit" onClick={() => setConsoleOpen(true)} aria-label="演示控制台">
            <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>演示控制台</Box>
          </Button>
          <NotificationMenu />
          <IconButton
            onClick={(e) => setUserAnchor(e.currentTarget)}
            aria-haspopup="menu"
            aria-label={`账户菜单：${account.name}`}
            sx={{ p: 0.5 }}>
            
            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>{account.name.slice(0, 1)}</Avatar>
          </IconButton>
          <Menu
            anchorEl={userAnchor}
            open={Boolean(userAnchor)}
            onClose={() => setUserAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="body2" fontWeight={600}>{account.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {account.email} · {account.systemRole === 'admin' ? '管理员' : '成员'}
              </Typography>
            </Box>
            <Divider />
            <MenuItem component={RouterLink} to="/settings/profile" onClick={() => setUserAnchor(null)}>
              <ListItemIcon><PersonOutlineIcon fontSize="small" /></ListItemIcon>
              个人设置
            </MenuItem>
            <MenuItem component={RouterLink} to="/guide" onClick={() => setUserAnchor(null)}>
              <ListItemIcon><MenuBookOutlinedIcon fontSize="small" /></ListItemIcon>
              方法与接入指南
            </MenuItem>
            <Divider />
            <MenuItem
              onClick={() => {
                setUserAnchor(null);
                signOut();
              }}>
              
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
              退出
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        sx={{
          width: isDesktop ? drawerWidth : 0,
          flexShrink: 0,
          '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', pt: isDesktop ? `${appBarHeight}px` : 0 }
        }}>
        
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 3 }, pt: { xs: '72px', sm: `${appBarHeight + 24}px` } }}>
        {state.settings.sessionExpired || accountDisabled ?
        <Paper variant="outlined" sx={{ maxWidth: 520, mx: 'auto', mt: 8, p: 4, textAlign: 'center' }}>
            <LockClockOutlinedIcon color="action" sx={{ fontSize: 40 }} />
            <Typography variant="h6" sx={{ mt: 1 }}>
              {accountDisabled ? '账户已停用' : '会话已失效'}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              {accountDisabled ?
            '当前账户已被管理员停用，无法查看执行或待决信息。请联系组织管理员。' :
            '为保护业务数据，当前不显示任何执行或待决信息。请重新登录（登录流程为演示）。'}
            </Typography>
            <Button
            variant="contained"
            sx={{ mt: 3 }}
            onClick={() => {
              updateSettings({ sessionExpired: false });
              signOut();
            }}>
            
              前往登录
            </Button>
          </Paper> :

        <Outlet />
        }
      </Box>

      <DemoConsole open={consoleOpen} onClose={() => setConsoleOpen(false)} />
    </Box>);

}