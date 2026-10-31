import { Alert,Box } from '@mui/material';
import { PageHeader } from '../components/PageHeader';
export function MockBusinessSystem(){return <Box><PageHeader title="业务系统"/><Alert severity="info">请返回实际业务系统操作。工作台不模拟业务资料、审批或创建执行。</Alert></Box>;}
