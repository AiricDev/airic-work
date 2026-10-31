import { Alert,Dialog } from '@mui/material';
export function DemoConsole({open,onClose}:{open:boolean;onClose:()=>void}){return <Dialog open={open} onClose={onClose}><Alert severity="info">正式工作台使用真实接口，不提供模拟操作。</Alert></Dialog>;}
