import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { Badge,Box,Button,Divider,IconButton,List,ListItemButton,ListItemText,Popover,Stack,Tooltip,Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '../../contexts/PlatformContext';
import { formatTime } from '../../utils/time';

const kindLabels = { decision: '待决', anomaly: '异常', result: '结果' } as const;

export function NotificationMenu() {
  const navigate = useNavigate();
  const { state, account, preference, markRead, markAllRead } = usePlatform();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const mine = state.notifications.filter((n) => n.userId === account.id);
  const unread = mine.filter((n) => !n.read && preference.notify[n.kind]).length;

  return (
    <>
      <Tooltip title="站内通知">
        <IconButton aria-label={`站内通知，${unread} 条未读`} onClick={(e) => setAnchor(e.currentTarget)}>
          <Badge badgeContent={unread} color="error">
            <NotificationsNoneOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { width: 360, maxWidth: '100vw' } }}>

        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>站内通知</Typography>
          <Button size="small" disabled={unread === 0} onClick={markAllRead}>全部标为已读</Button>
        </Stack>
        <Divider />
        {mine.length === 0 ?
        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>通知列表尚未接入。待决事项仍在工作台显示。</Typography> :

        <List dense disablePadding sx={{ maxHeight: 360, overflow: 'auto' }}>
            {mine.map((n) => {
            const muted = !preference.notify[n.kind];
            return (
              <ListItemButton
                key={n.id}
                onClick={() => {
                  markRead(n.id);
                  setAnchor(null);
                  navigate(n.link);
                }}
                sx={{ alignItems: 'flex-start', borderLeft: 3, borderColor: n.read ? 'transparent' : 'primary.main' }}>

                  <ListItemText
                  primary={
                  <Typography variant="body2" fontWeight={n.read ? 400 : 600}>
                        [{kindLabels[n.kind]}] {n.title}
                      </Typography>
                  }
                  secondary={
                  <>
                        {n.detail}
                        <Box component="span" sx={{ display: 'block' }}>
                          {formatTime(n.at)} · {n.read ? '已读' : '未读'}
                          {muted && ' · 已关闭此类提示'}
                        </Box>
                      </>
                  } />

                </ListItemButton>);

          })}
          </List>
        }
        <Divider />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 2, py: 1 }}>
          已读不等于已处理；待决事项仍需在对应请求中正式提交。邮件与推送不在本轮范围。
        </Typography>
      </Popover>
    </>);

}
