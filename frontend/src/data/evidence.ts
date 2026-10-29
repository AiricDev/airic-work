import type { Evidence } from '../types/workbench';

export const evidence: Evidence[] = [
{
  id: 'ev-a1',
  title: '境外实验室测试报告（译本）',
  system: 'CertLab（模拟）',
  objectId: 'DOC-1190',
  version: 'v1',
  locator: '第 3 页 · 测试结论段',
  excerpt:
  '报告编号：TR-2026-0815。样品型号：EM-300A。依据所列方法完成计量准确度测试，测试结论：符合。（以下为译本，原件签章页未随附。）',
  agentSummary: '译本中的报告编号与样品型号与申请记录一致；末页未附原件签章页影印件。'
},
{
  id: 'ev-a2',
  title: '申请材料清单',
  system: 'CertLab（模拟）',
  objectId: 'DOC-1182',
  version: 'v3',
  locator: '第 4.2 项',
  excerpt: '4.2 型式试验报告 —— 例外材料：境外实验室出具，申请人提交译本。备注：原件后补。',
  agentSummary: '申请人自行将第 4.2 项标记为例外材料，并声明原件后补。'
},
{
  id: 'ev-a3',
  title: '实验室认可证书扫描件',
  system: 'CertLab（模拟）',
  objectId: 'DOC-1204',
  version: 'v1',
  locator: '第 1 页 · 有效期',
  excerpt: '认可编号：LAB-DEMO-771。有效期：2025-01-10 至 2027-01-09。（扫描件）',
  agentSummary: '扫描件显示有效期覆盖报告测试日期；原件未核验。'
},
{
  id: 'ev-a4',
  title: '第 1–3 项材料核对表',
  system: 'Airic Work 执行产物',
  objectId: 'ART-0042-01',
  version: 'r2',
  locator: '全文',
  excerpt: '第 1 项：一致；第 2 项：一致；第 3 项：一致。核对依据见各项业务对象引用。',
  agentSummary: 'Agent 生成的核对表草稿，尚未写入业务系统。'
},
{
  id: 'ev-d1',
  title: '样品送检登记表',
  system: 'CertLab（模拟）',
  objectId: 'DOC-2210',
  version: 'v2',
  locator: '第 2 页 · S-11 至 S-13',
  excerpt: 'S-11 送检日期 2026-09-02；S-12 送检日期（空）；S-13 送检日期 2026-09-04。',
  agentSummary: 'S-12 的送检日期栏为空，其他样品日期完整。'
},
{
  id: 'ev-d2',
  title: '额定参数检测报告',
  system: 'CertLab（模拟）',
  objectId: 'DOC-2231',
  version: 'v1',
  locator: '表 3 · 额定电流',
  excerpt: '额定电流标称值 32 A，实测值 32.67 A，偏差 +2.1%。环境温度：未记录。',
  agentSummary: '实测偏差 +2.1%；测试环境温度缺失。'
}];