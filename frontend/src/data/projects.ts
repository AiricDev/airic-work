import type { Project } from '../types/workbench';
import { minutesAgo } from '../utils/time';

export const projects: Project[] = [
{
  id: 'p-meter',
  name: '智能电表产品认证（虚构）',
  sourceSystem: 'CertLab（模拟）',
  businessRef: 'DEMO-PRJ-0042',
  businessTaskRef: '大任务 DEMO-TASK-0042-A',
  description: '演示用虚构项目，不对应任何真实认证流程。',
  lastActivity: minutesAgo(12)
},
{
  id: 'p-charger',
  name: '充电桩安全认证（虚构）',
  sourceSystem: 'CertLab（模拟）',
  businessRef: 'DEMO-PRJ-0057',
  businessTaskRef: '大任务 DEMO-TASK-0057-C',
  description: '演示用虚构项目，不对应任何真实认证流程。',
  lastActivity: minutesAgo(35)
},
{
  id: 'p-device',
  name: '医疗器械注册资料预审（虚构）',
  sourceSystem: 'RegDesk（模拟）',
  businessRef: 'DEMO-PRJ-0103',
  businessTaskRef: '大任务 DEMO-TASK-0103-R',
  description: '演示用虚构项目，不对应任何真实注册流程。',
  lastActivity: minutesAgo(3)
}];