import type { ExternalClientGrant,McpReadLog } from '../types/platform';
import { minutesAgo } from '../utils/time';

const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const seedClientGrants: ExternalClientGrant[] = [
{
  id: 'CG-01',
  userId: 'u-zhang',
  clientName: 'Claude Code（张敏本地，演示）',
  clientRef: 'client-ref://demo/zhang-claude-code',
  scope: '项目「智能电表产品认证」下的执行记录',
  resources: ['执行记录索引', 'Trajectory 分页', 'Decision Episode', '版本与 Context 引用'],
  projectIds: ['p-meter'],
  status: '有效',
  grantedAt: minutesAgo(4320),
  expiresAt: daysAhead(14)
},
{
  id: 'CG-02',
  userId: 'u-zhang',
  clientName: 'Codex（张敏，演示）',
  clientRef: 'client-ref://demo/zhang-codex',
  scope: '仅 Decision Episode',
  resources: ['Decision Episode'],
  projectIds: ['p-meter'],
  status: '已过期',
  grantedAt: minutesAgo(30000),
  expiresAt: minutesAgo(1440)
}];


export const seedReadLogs: McpReadLog[] = [
{ id: 'RL-02', at: minutesAgo(300), clientName: 'Claude Code（张敏本地，演示）', userName: '张敏', resource: 'Decision Episode EP-0047', result: '已交付', note: '含 2 条证据限制说明；未交付业务原文' },
{ id: 'RL-01', at: minutesAgo(1500), clientName: 'Codex（张敏，演示）', userName: '张敏', resource: 'Trajectory EX-7F3A21 第 1 页', result: '已拒绝', note: '客户端授权已过期' }];
