import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import {
Alert,
Box,
Chip,
FormControl,
IconButton,
InputAdornment,
InputLabel,
Menu,
MenuItem,
Paper,
Select,
Stack,
Table,
TableBody,
TableCell,
TableContainer,
TableHead,
TableRow,
TextField,
Typography
} from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';
import { CreateUserDialog } from '../components/users/CreateUserDialog';
import { UserActionDialog,type UserAction } from '../components/users/UserActionDialog';
import { usePlatform } from '../contexts/PlatformContext';
import type { ActionResult } from '../types/platform';
import type { DemoUser } from '../types/workbench';
import { formatTime } from '../utils/time';

export function UserManagement() {
  const navigate = useNavigate();
  const { state, account } = usePlatform();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [menu, setMenu] = useState<{anchor: HTMLElement;user: DemoUser;} | null>(null);
  const [pending, setPending] = useState<{user: DemoUser;action: UserAction;} | null>(null);

  const rows = state.users.filter(
    (u) => `${u.name}${u.email}`.toLowerCase().includes(q.toLowerCase()) && (!role || u.systemRole === role) && (!status || u.status === status)
  );

  const actionsFor = (u: DemoUser): {action: UserAction;label: string;}[] => {
    const list: {action: UserAction;label: string;}[] = [];
    list.push(u.systemRole === 'admin' ? { action: 'demote', label: '改为成员' } : { action: 'promote', label: '设为管理员' });
    if (u.status === 'active' && u.id !== account.id) list.push({ action: 'disable', label: '停用' });
    if (u.status === 'disabled') list.push({ action: 'enable', label: '恢复' });
    return list;
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <PageHeader
        title="用户管理"
        description="集成方用户首次有效请求自动创建并获得使用资格；在此管理启用状态与管理员权限。"
         />

      {result && <Alert severity={result.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setResult(null)}>{result.message}</Alert>}
      <Paper variant="outlined">
        <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索姓名或邮箱"
            sx={{ width: { xs: '100%', sm: 280 } }}
            inputProps={{ 'aria-label': '搜索用户' }}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />

          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="u-role">角色</InputLabel>
            <Select labelId="u-role" label="角色" value={role} onChange={(e) => setRole(e.target.value)}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="admin">管理员</MenuItem>
              <MenuItem value="member">成员</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="u-status">状态</InputLabel>
            <Select labelId="u-status" label="状态" value={status} onChange={(e) => setStatus(e.target.value)}>
              <MenuItem value="">全部</MenuItem>
              <MenuItem value="active">有效</MenuItem>
              <MenuItem value="disabled">已停用</MenuItem>
            </Select>
          </FormControl>
        </Stack>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>姓名</TableCell>
                <TableCell>邮箱</TableCell>
                <TableCell>角色</TableCell>
                <TableCell>账户状态</TableCell>
                <TableCell>最近登录</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((u) =>
              <TableRow key={u.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/settings/users/${u.id}`)}>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{u.name}{u.id === account.id && '（你）'}</Typography>
                    <Typography variant="caption" color="text.secondary">{u.role}</Typography>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.systemRole === 'admin' ? '管理员' : '成员'}</TableCell>
                  <TableCell><Chip variant="outlined" color={u.status === 'active' ? 'success' : 'default'} label={u.status === 'active' ? '有效' : '已停用'} /></TableCell>
                  <TableCell>{u.lastLoginAt ? formatTime(u.lastLoginAt) : '从未'}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton aria-label={`${u.name} 的操作`} onClick={(e) => setMenu({ anchor: e.currentTarget, user: u })}><MoreVertIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rows.length === 0 && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>没有符合条件的用户。</Typography>}
        </TableContainer>
      </Paper>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        {menu && actionsFor(menu.user).map((a) =>
        <MenuItem key={a.action} onClick={() => {setPending({ user: menu.user, action: a.action });setMenu(null);}}>{a.label}</MenuItem>
        )}
      </Menu>
      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={setResult} />
      <UserActionDialog user={pending?.user ?? null} action={pending?.action ?? null} onClose={() => setPending(null)} onDone={setResult} />
    </Box>);

}
