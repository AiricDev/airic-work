import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Divider, Drawer, IconButton, Link, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import type { Execution } from '../../types/workbench';
import { usePlatform } from '../../contexts/PlatformContext';
import { executionOrigins } from '../../data/accounts';
import { formatTime } from '../../utils/time';

const mask = (id: string) => id.length > 4 ? `${id.slice(0, 3)}***${id.slice(-2)}` : '***';

export function ExecutionIdentity({ execution }: {execution: Execution;}) {
  const { state, account } = usePlatform();
  const [open, setOpen] = useState(false);
  const owner = state.users.find((u) => u.id === execution.ownerId);
  const origin = executionOrigins.find((o) => o.executionId === execution.id);
  const initiator = state.users.find((u) => u.id === origin?.initiatorId);
  const identity = state.identities.find((i) => i.userId === execution.ownerId && i.system === execution.source.system);
  const delegation = state.delegations.find((d) => d.userId === execution.ownerId && d.system === execution.source.system);
  const available = identity?.status === '已验证' && delegation?.status === '有效';
  const isOwner = account.id === execution.ownerId;

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <BadgeOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography variant="caption" color="text.secondary">
          代表 {owner?.name ?? '未知'} · {execution.source.system}
          {identity ? ` · ${mask(identity.externalId)}` : ' · 未关联业务账号'}
        </Typography>
        <Chip
          variant="outlined"
          color={available ? 'success' : 'warning'}
          label={available ? '业务授权可用' : '业务授权不可用'}
          sx={{ height: 20 }} />
        
        <Link component="button" variant="caption" onClick={() => setOpen(true)}>执行身份详情</Link>
      </Stack>
      {!available &&
      <Alert severity="warning" sx={{ mt: 1 }}>
          {isOwner ?
        <>
              执行所代表的业务授权当前不可用，依赖该授权的领域操作不会进行。
              <Link component={RouterLink} to="/settings/profile" sx={{ ml: 0.5 }}>前往个人设置重新授权</Link>
            </> :

        '执行所代表的业务授权当前不可用；只有执行归属人本人可以重新授权。'
        }
        </Alert>
      }

      <Drawer anchor="right" open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 480 } } }}>
        <Stack direction="row" alignItems="center" sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle1" component="h2" sx={{ flex: 1 }}>执行身份</Typography>
          <IconButton aria-label="关闭执行身份详情" onClick={() => setOpen(false)}><CloseIcon /></IconButton>
        </Stack>
        <Box sx={{ p: 2 }}>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 1, '& dd': { m: 0 } }}>
            <Typography component="dt" variant="body2" color="text.secondary">API 调用方</Typography>
            <Typography component="dd" variant="body2">{origin?.caller ?? '未知'}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">实际发起人</Typography>
            <Typography component="dd" variant="body2">{initiator?.name ?? '未知'}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">归属业务用户</Typography>
            <Typography component="dd" variant="body2">{owner?.name ?? '未知'}（唯一归属人）</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">技术执行者</Typography>
            <Typography component="dd" variant="body2">{origin?.technicalExecutor ?? '未知'}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">业务账号</Typography>
            <Typography component="dd" variant="body2">
              {identity ? `${identity.system} ${mask(identity.externalId)} · ${identity.status}` : '未关联'}
            </Typography>
            <Typography component="dt" variant="body2" color="text.secondary">授权范围</Typography>
            <Typography component="dd" variant="body2">{delegation ? `${delegation.scope}（${delegation.status}）` : '未授权'}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">执行范围</Typography>
            <Typography component="dd" variant="body2">{origin?.scope ?? execution.scope}</Typography>
            <Typography component="dt" variant="body2" color="text.secondary">最近校验</Typography>
            <Typography component="dd" variant="body2">{origin ? formatTime(origin.lastVerifiedAt) : '未知'}</Typography>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary" component="p">
            实际决策处理人在每条处理记录中单独记录。有效映射不等于拥有业务审批权限；平台不使用共享服务账号或管理员账号代替用户操作。
          </Typography>
          {!available && isOwner &&
          <Button component={RouterLink} to="/settings/profile" variant="outlined" sx={{ mt: 2 }}>前往个人设置</Button>
          }
        </Box>
      </Drawer>
    </>);

}