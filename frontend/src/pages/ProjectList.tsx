import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useWorkbench } from '../contexts/WorkbenchContext';
import { getVisibleExecutions, getVisibleProjects, getVisibleRequests, projectLastActivity } from '../utils/selectors';
import { formatTime, fromNow } from '../utils/time';

export function ProjectList() {
  const navigate = useNavigate();
  const { state, currentUser } = useWorkbench();
  const projects = getVisibleProjects(currentUser);
  const executions = getVisibleExecutions(state.executions, currentUser);
  const requests = getVisibleRequests(state.requests, state.executions, currentUser);

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">
          项目
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          按业务项目查看 Agent 执行与需要你处理的事项。数量仅统计你有权查看的对象，不代表业务完成度。
        </Typography>
      </Box>

      <Paper variant="outlined">
        {projects.length === 0 ?
        <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="subtitle2">暂无可见项目</Typography>
            <Typography color="text.secondary">项目由业务系统发起执行时关联，工作台不提供新建入口。</Typography>
          </Box> :

        <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ minWidth: 220 }}>项目名称</TableCell>
                  <TableCell sx={{ minWidth: 220 }}>来源系统 / 大任务引用</TableCell>
                  <TableCell align="center">可见执行</TableCell>
                  <TableCell align="center">需我处理</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>最近活动</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {projects.map((p) => {
                const execIds = executions.filter((e) => e.projectId === p.id).map((e) => e.id);
                const mine = requests.filter((r) => execIds.includes(r.executionId) && r.status === 'pending' && r.ownerId === currentUser.id).length;
                const last = projectLastActivity(p, executions);
                const open = () => navigate(`/projects/${p.id}`);
                return (
                  <TableRow
                    key={p.id}
                    hover
                    tabIndex={0}
                    sx={{ cursor: 'pointer' }}
                    onClick={open}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') open();
                    }}>
                    
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>
                          {p.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                          {p.businessRef}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.sourceSystem}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {p.businessTaskRef}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{execIds.length}</TableCell>
                      <TableCell align="center">
                        {mine > 0 ? <Chip color="warning" label={mine} /> : <Typography variant="body2" color="text.disabled">0</Typography>}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Typography variant="body2" title={formatTime(last)}>
                          {fromNow(last)}
                        </Typography>
                      </TableCell>
                    </TableRow>);

              })}
              </TableBody>
            </Table>
          </TableContainer>
        }
      </Paper>
    </Box>);

}