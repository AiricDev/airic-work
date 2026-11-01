import { decisionSummary } from '../utils/decisionSummary';
import { Alert,Avatar,Box,Breadcrumbs,Button,Chip,Link,Paper,Stack,Tab,Tabs,Typography } from '@mui/material';
import { useState } from 'react';
import { Link as RouterLink,useParams } from 'react-router-dom';
import { UserActionDialog,type UserAction } from '../components/users/UserActionDialog';
import { usePlatform } from '../contexts/PlatformContext';
import { useWorkbench } from '../contexts/WorkbenchContext';
import type { ActionResult } from '../types/platform';
import { responsibilitiesFor } from '../utils/responsibilities';
import { formatTime } from '../utils/time';

export function UserDetail() {
  const { userId } = useParams();
  const { state, account } = usePlatform();
  const wb = useWorkbench();
  const [tab, setTab] = useState('overview');
  const [action, setAction] = useState<UserAction | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const user = state.users.find((u) => u.id === userId);

  if (!user) {
    return (
      <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', maxWidth: 560, mx: 'auto', mt: 4 }}>
        <Typography variant="h6">用户不存在</Typography>
        <Button component={RouterLink} to="/settings/users" variant="outlined" sx={{ mt: 2 }}>返回用户管理</Button>
      </Paper>);

  }

  const resp = responsibilitiesFor(user.id, wb.state);

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      <Breadcrumbs aria-label="位置">
        <Link component={RouterLink} to="/settings/users" underline="hover" color="inherit">用户管理</Link>
        <Typography color="text.primary">{user.name}</Typography>
      </Breadcrumbs>
      <Paper variant="outlined" sx={{ p: 2, mt: 1, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Avatar>{user.name.slice(0, 1)}</Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" component="h1">{user.name}</Typography>
            <Typography variant="body2" color="text.secondary">{user.email}</Typography>
          </Box>
          <Chip variant="outlined" label={user.systemRole === 'admin' ? '管理员' : '成员'} />
          <Chip variant="outlined" color={user.status === 'active' ? 'success' : 'default'} label={user.status === 'active' ? '有效' : '已停用'} />
          <Button variant="outlined" onClick={() => setAction(user.systemRole === 'admin' ? 'demote' : 'promote')}>
            {user.systemRole === 'admin' ? '改为成员' : '设为管理员'}
          </Button>
          {user.status === 'active' ?
          <Button color="error" disabled={user.id === account.id} onClick={() => setAction('disable')}>停用</Button> :

          <Button onClick={() => setAction('enable')}>恢复</Button>
          }
        </Stack>
        {user.id === account.id && <Typography variant="caption" color="text.secondary">本轮不允许在管理页停用自己。</Typography>}
      </Paper>
      {result && <Alert severity={result.ok ? 'success' : 'error'} sx={{ mb: 2 }}>{result.message}</Alert>}

      <Tabs value={tab} onChange={(_, v: string) => setTab(v)} sx={{ mb: 1.5 }}>
        <Tab value="overview" label="概览" />


      </Tabs>
      <Paper variant="outlined" sx={{ p: 2 }}>
        {tab === 'overview' &&
        <Stack spacing={2}>
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.75, '& dd': { m: 0 } }}>
              <Typography component="dt" variant="body2" color="text.secondary">职务说明</Typography>
              <Typography component="dd" variant="body2">{user.role}</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">最近登录</Typography>
              <Typography component="dd" variant="body2">{user.lastLoginAt ? formatTime(user.lastLoginAt) : '从未'}</Typography>
            </Box>
            <Box>
              <Typography variant="subtitle2">待处理责任引用</Typography>
              {resp.counts.executions + resp.counts.requests === 0 ?
            <Typography variant="body2" color="text.secondary">无。</Typography> :

            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {resp.executions.map((e) => <Typography component="li" variant="body2" key={e.id}>执行唯一归属人：<Link component={RouterLink} to={`/executions/${e.id}`}>{e.goal}</Link></Typography>)}
                  {resp.requests.map((r) => <Typography component="li" variant="body2" key={r.id}>待处理请求：{r.id} {decisionSummary(r)}</Typography>)}
                </Box>
            }
              <Typography variant="caption" color="text.secondary">仅显示你有权查看的引用；管理员不因角色获得他人的专业判断或业务审批权。</Typography>
            </Box>
          </Stack>
        }


      </Paper>
      <UserActionDialog user={action ? user : null} action={action} onClose={() => setAction(null)} onDone={setResult} />
    </Box>);

}
