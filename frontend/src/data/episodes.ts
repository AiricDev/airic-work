import type { Episode } from '../types/platform';

export const episodes: Episode[] = [
{
  id: 'EP-0047',
  executionId: 'EX-7F3A21',
  requestId: 'DR-1031',
  omSha: 'demo-3f9a2c1d07e5b8a3f912',
  omPath: 'decisions/qualification/license-check.md',
  title: '营业执照版本确认',
  question: '申请人提交的营业执照副本是否为最新版本？',
  context: [
  { name: '执照副本换发日期', source: 'CertLab 申请材料清单 DOC-1182 v3', status: '就绪' },
  { name: '公开登记信息', source: 'Agent 观察，未保存原始响应', status: '待核实' },
  { name: '登记机关最新换发记录', source: '无可用领域能力', status: '缺失' }],

  conclusion: '执照副本为最新版本（人工补充事实）',
  intervention: '张敏 通过工作台补充事实，来源：CertLab 申请记录 · 附件 3',
  followUp: 'Agent 依据该事实继续申请人资质核对，形成已确认产物“申请人营业执照有效性核对”。',
  limits: ['公开登记信息的读取过程没有保存原始响应', '无法确认 Agent 当时实际读取了文件中的哪些段落'],
  eventIds: ['T-004', 'T-005', 'T-006', 'T-007'],
  evidenceIds: ['ev-a2']
}];