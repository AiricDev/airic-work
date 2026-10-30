import React, { useState } from 'react';
import { Alert, Box, Button, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { externalMethods } from '../data/integrations';
import { usePlatform } from '../contexts/PlatformContext';
import { PageHeader } from '../components/PageHeader';
import { McpReadPanel } from '../components/mcp/McpReadPanel';

const interfaces = [
{ name: '标准任务 / 决策 API', direction: '业务系统 → Airic Work', scope: '创建、查询、取消执行；查询、处理 DecisionRequest。创建幂等，接受不等于已执行，取消不等于已停止。', boundary: '调用方与实际用户需可信关联；路径与认证协议 TBD' },
{ name: '出站业务 MCP', direction: '后台 Agent → 业务系统', scope: '以执行归属人本人经验证且有效的业务身份读取、取证与操作。', boundary: '不回退到管理员、共享服务账号或其他用户' },
{ name: 'Git 获取', direction: 'Airic Work → GitHub/GitLab', scope: '同步本实例唯一 OM 仓库的文件、提交与差异；新执行启动前确认来源分支最新提交。', boundary: '变更管理、Review 与合并完全在 Git 平台' },
{ name: '入站轨迹只读 MCP', direction: '外部 Agent → Airic Work', scope: '在本人授权范围内定位执行记录、分页读取 Trajectory、读取 Episode 及必要版本与 Context 引用。', boundary: '不创建/取消执行、不提交决定、不修改 OM、不读取令牌' }];


export function Guide() {
  const { state } = usePlatform();
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(true);
  };

  const card = (title: string, children: React.ReactNode, id?: string) =>
  <Paper variant="outlined" sx={{ p: 3 }} id={id}>
      <Typography variant="subtitle1" component="h2" sx={{ mb: 1 }}>{title}</Typography>
      {children}
    </Paper>;


  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      <PageHeader title="方法与接入指南" description="执行方法、外部 OME 协作、四类接口及其边界。平台不运行学习或反思流程。" />
      <Stack spacing={2}>
        {card('执行方法与外部 OME',
        <Stack spacing={1.5}>
            {externalMethods.map((s) =>
          <Box key={s.name}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{s.version}</Typography>
                  <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(`${s.name} ${s.version}`)}>复制版本</Button>
                </Stack>
                <Typography variant="body2" color="text.secondary">{s.role}</Typography>
              </Box>
          )}
            <Alert severity="info">安装命令与分发地址尚未确认（TBD），此处不提供伪造的安装方式。</Alert>
          </Stack>
        )}
        {card('从实践到 OM 改进（在外部完成）',
        <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
            <Typography component="li" variant="body2">在执行轨迹与 Episode 中确认记录覆盖、Context 来源与实际使用的 SHA。</Typography>
            <Typography component="li" variant="body2">在个人设置中授权外部客户端的最小读取范围；外部 Agent 通过只读 MCP 分页取得授权记录。</Typography>
            <Typography component="li" variant="body2">在自己选择的 Agent 环境中使用 OME（含 Reflective Learning 模块）分析、修改本地 OM 并验证。</Typography>
            <Typography component="li" variant="body2">经 GitHub/GitLab PR/MR Review 合并；平台同步来源分支后，未来新执行使用最新确认 SHA，既有执行保持原 SHA。</Typography>
          </Box>
        )}
        {card('四类接口与边界',
        <>
            <Box sx={{ overflowX: 'auto' }}>
              <Table>
                <TableHead><TableRow><TableCell>接口</TableCell><TableCell>方向</TableCell><TableCell>产品语义</TableCell><TableCell>边界</TableCell></TableRow></TableHead>
                <TableBody>
                  {interfaces.map((a) =>
                <TableRow key={a.name}>
                      <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{a.name}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.direction}</TableCell>
                      <TableCell>{a.scope}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{a.boundary}</TableCell>
                    </TableRow>
                )}
                </TableBody>
              </Table>
            </Box>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
              技术调用方、实际发起用户、执行代表的业务主体、Agent 技术执行者与实际决策处理人分别记录。公开路径、MCP 工具名与认证协议均 TBD。
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
              <Typography variant="body2">本实例 OM 仓库：</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{state.omSource.repo}@{state.omSource.branch}</Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(`${state.omSource.repo}@${state.omSource.branch}`)}>复制仓库引用</Button>
            </Stack>
          </>
        )}
        {card('只读轨迹 MCP 读取演示', <McpReadPanel />, 'mcp')}
      </Stack>
      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message="已复制" />
    </Box>);

}
