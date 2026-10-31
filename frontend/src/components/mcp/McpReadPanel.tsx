import { Alert,Stack,Typography } from '@mui/material';
export function McpReadPanel(_props:{defaultExecutionId?:string}){return <Stack spacing={2}><Typography variant="subtitle1">Airic Work MCP</Typography><Alert severity="info">只读 MCP 的应用能力已定义，网络 transport 尚未交付。Session 与 Decision Episode 可在工作台查看；此处不模拟 MCP 读取。</Alert></Stack>;}
