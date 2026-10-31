import { Alert,Stack,Typography } from '@mui/material';
import { McpReadPanel } from '../mcp/McpReadPanel';
export function TrajectoryMcpSection() {
  return <Stack spacing={2}><Typography variant="h6">Airic Work MCP</Typography><Alert severity="info">外部 Agent 配置集成方身份 token 后读取本人 Session 和 Decision Episode。没有独立外部授权或读取审计产品实体；端点与认证协议待真实接入。</Alert><McpReadPanel /></Stack>;
}
