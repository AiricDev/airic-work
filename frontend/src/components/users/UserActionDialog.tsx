import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Link, Typography } from '@mui/material';
import type { DemoUser } from '../../types/workbench';
import type { ActionResult } from '../../types/platform';
import { usePlatform } from '../../contexts/PlatformContext';
import { useWorkbench } from '../../contexts/WorkbenchContext';
import { responsibilitiesFor } from '../../utils/responsibilities';

export type UserAction = 'promote' | 'demote' | 'disable' | 'enable';

interface UserActionDialogProps {
  user: DemoUser | null;
  action: UserAction | null;
  onClose: () => void;
  onDone: (r: ActionResult) => void;
}

const titles: Record<UserAction, string> = { promote: '设为管理员', demote: '改为成员', disable: '停用用户', enable: '恢复用户' };

export function UserActionDialog({ user, action, onClose, onDone }: UserActionDialogProps) {
  const { changeRole, setUserStatus } = usePlatform();
  const { state } = useWorkbench();
  if (!user || !action) return null;
  const resp = responsibilitiesFor(user.id, state);

  const confirm = () => {
    const r =
    action === 'promote' ? changeRole(user.id, 'admin') :
    action === 'demote' ? changeRole(user.id, 'member') :
    setUserStatus(user.id, action === 'disable' ? 'disabled' : 'active', resp.counts);
    onDone(r);
    onClose();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titles[action]}：{user.name}</DialogTitle>
      <DialogContent dividers>
        {(action === 'promote' || action === 'demote') &&
        <Alert severity="info">管理员角色仅影响系统配置与用户管理；不授予业务对象查看、专业判断或业务审批权限。</Alert>
        }
        {action === 'disable' &&
        <>
            <Typography variant="subtitle2">待处理责任</Typography>
            {resp.counts.executions + resp.counts.requests === 0 ?
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>无进行中执行或待处理请求。</Typography> :

          <Box component="ul" sx={{ m: 0, pl: 2.5, mb: 1 }}>
                {resp.executions.map((e) =>
            <Typography component="li" variant="body2" key={e.id}>执行唯一归属人：<Link component={RouterLink} to={`/executions/${e.id}`}>{e.goal}</Link></Typography>
            )}
                <Typography component="li" variant="body2">待处理请求 {resp.counts.requests} 个</Typography>
              </Box>
          }
            <Alert severity="warning">停用不删除历史处理人、审计或轨迹；存在未交接责任时将被阻止，本轮不提供转派，管理员也不会自动接管决定。</Alert>
          </>
        }
        {action === 'enable' && <Alert severity="info">恢复不会自动恢复外部业务授权，需本人重新授权。</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button variant="contained" color={action === 'disable' ? 'error' : 'primary'} onClick={confirm}>确认{titles[action]}</Button>
      </DialogActions>
    </Dialog>);

}