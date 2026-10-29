import type { Execution } from '../types/workbench';
import { minutesAgo } from '../utils/time';

export const executions: Execution[] = [
{
  id: 'EX-7F3A21',
  projectId: 'p-meter',
  ownerId: 'u-zhang',
  goal: '证据完整性检查 · 申请批次 B-03',
  scope: '认证申请 DEMO-APP-0042 第 1–5 项证据材料',
  source: { system: 'CertLab（模拟）', ref: 'DEMO-APP-0042', label: '认证申请 DEMO-APP-0042' },
  omRepo: 'demo-org/airic-om',
  omCommit: 'demo-3f9a2c1',
  runtimeVersion: 'Pi Durable（演示标识 rt-demo-2）',
  skillVersion: 'airic-work-skill demo-0.4',
  startedAt: minutesAgo(130),
  updatedAt: minutesAgo(12),
  lastSyncedAt: minutesAgo(1),
  ended: false,
  summary: {
    doing: ['独立材料核对：第 5 项型式试验报告'],
    waiting: ['第 4.2 项：例外材料是否可接受', '第 1–3 项核对结果写入业务系统'],
    canContinue: ['第 5 项及之后的独立材料核对', '申请人基础信息复核']
  },
  events: [
  { id: 'evt-a1', at: minutesAgo(130), kind: 'system', title: '执行由业务系统发起', detail: 'CertLab（模拟）通过任务 API 创建；依据 OM demo-3f9a2c1' },
  { id: 'evt-a2', at: minutesAgo(118), kind: 'request', title: '发起待决事项：营业执照版本确认', requestId: 'DR-1031' },
  { id: 'evt-a3', at: minutesAgo(96), kind: 'human', title: '张敏 补充事实（工作台）', detail: '营业执照副本为最新版本', requestId: 'DR-1031' },
  { id: 'evt-a4', at: minutesAgo(94), kind: 'resume', title: '相关工作已继续：申请人资质核对', requestId: 'DR-1031' },
  { id: 'evt-a5', at: minutesAgo(70), kind: 'receipt', title: '第 1–3 项材料核对完成', detail: '3 份材料与申请记录一致（业务系统读取回执）', evidenceIds: ['ev-a4'] },
  { id: 'evt-a6', at: minutesAgo(60), kind: 'request', title: '发起待决事项：写入业务系统授权', requestId: 'DR-1052' },
  { id: 'evt-a7', at: minutesAgo(42), kind: 'agent', title: '第 4.2 项发现例外材料', detail: '境外实验室报告仅提供译本', evidenceIds: ['ev-a1', 'ev-a2'] },
  { id: 'evt-a8', at: minutesAgo(40), kind: 'request', title: '发起待决事项：例外材料有效性判断', requestId: 'DR-1047' },
  { id: 'evt-a9', at: minutesAgo(12), kind: 'agent', title: '开始核对第 5 项型式试验报告', detail: '该项不依赖第 4.2 项的判断' }],

  results: [
  { id: 'res-a1', title: '申请人营业执照有效性核对', status: 'confirmed', detail: '依据人工补充事实与业务记录确认', evidenceIds: ['ev-a2'] },
  { id: 'res-a2', title: '第 1–3 项材料核对表', status: 'draft', detail: '已生成，尚未写入业务系统（等待授权）', evidenceIds: ['ev-a4'] },
  { id: 'res-a3', title: '向申请人发送补件提醒', status: 'unknown', detail: '调用已发起，未收到业务系统回执，效果未知' }],

  logs: [
  { id: 'log-a1', at: minutesAgo(128), tool: 'certlab.get_application', call: '查询申请 DEMO-APP-0042', receipt: '返回 5 项证据材料清单', receiptStatus: 'confirmed' },
  { id: 'log-a2', at: minutesAgo(90), tool: 'certlab.get_document', call: '读取 DOC-1182 v3', receipt: '读取成功', receiptStatus: 'confirmed' },
  { id: 'log-a3', at: minutesAgo(45), tool: 'certlab.get_document', call: '读取 DOC-1190 v1', receipt: '读取成功', receiptStatus: 'confirmed' },
  { id: 'log-a4', at: minutesAgo(41), tool: 'certlab.send_notice', call: '发送补件提醒（第 4.2 项原件）', receipt: '未收到回执', receiptStatus: 'none' },
  { id: 'log-a5', at: minutesAgo(40), tool: 'decision.create_request', call: '创建待决事项 DR-1047', receipt: '已创建', receiptStatus: 'confirmed' },
  { id: 'log-a6', at: minutesAgo(12), tool: 'certlab.get_document', call: '读取第 5 项型式试验报告', receipt: '等待返回', receiptStatus: 'pending' }],

  cancellation: null
},
{
  id: 'EX-2C9E04',
  projectId: 'p-meter',
  ownerId: 'u-zhang',
  goal: '资料核对 · 申请人基础信息',
  scope: '认证申请 DEMO-APP-0042 的申请人、授权代表与联系人信息',
  source: { system: 'CertLab（模拟）', ref: 'DEMO-APP-0042', label: '认证申请 DEMO-APP-0042' },
  omRepo: 'demo-org/airic-om',
  omCommit: 'demo-5d70b88',
  runtimeVersion: 'Pi Durable（演示标识 rt-demo-2）',
  skillVersion: 'airic-work-skill demo-0.4',
  startedAt: minutesAgo(50),
  updatedAt: minutesAgo(5),
  lastSyncedAt: minutesAgo(1),
  ended: false,
  summary: {
    doing: ['核对授权代表与联系人信息'],
    waiting: [],
    canContinue: ['生成基础信息核对摘要']
  },
  events: [
  { id: 'evt-b1', at: minutesAgo(50), kind: 'system', title: '执行由业务系统发起', detail: 'CertLab（模拟）通过任务 API 创建' },
  { id: 'evt-b2', at: minutesAgo(30), kind: 'receipt', title: '申请人名称与登记信息一致', detail: '业务系统读取回执' },
  { id: 'evt-b3', at: minutesAgo(5), kind: 'agent', title: '开始核对授权代表信息' }],

  results: [{ id: 'res-b1', title: '申请人名称核对', status: 'confirmed', detail: '与业务记录一致' }],
  logs: [
  { id: 'log-b1', at: minutesAgo(48), tool: 'certlab.get_applicant', call: '查询申请人信息', receipt: '读取成功', receiptStatus: 'confirmed' }],

  cancellation: null
},
{
  id: 'EX-5E12C8',
  projectId: 'p-charger',
  ownerId: 'u-zhang',
  goal: '证据完整性检查 · 申请批次 C-01',
  scope: '认证申请 DEMO-APP-0057 第 1–4 项证据材料',
  source: { system: 'CertLab（模拟）', ref: 'DEMO-APP-0057', label: '认证申请 DEMO-APP-0057' },
  omRepo: 'demo-org/airic-om',
  omCommit: 'demo-3f9a2c1',
  runtimeVersion: 'Pi Durable（演示标识 rt-demo-2）',
  skillVersion: 'airic-work-skill demo-0.4',
  startedAt: minutesAgo(240),
  updatedAt: minutesAgo(35),
  lastSyncedAt: minutesAgo(2),
  ended: false,
  summary: {
    doing: ['第 1、2 项材料核对'],
    waiting: ['样品 S-12 送检时效核对', '第 3 项额定参数偏差判断'],
    canContinue: ['第 4 项绝缘测试报告核对']
  },
  events: [
  { id: 'evt-d1', at: minutesAgo(240), kind: 'system', title: '执行由业务系统发起', detail: 'CertLab（模拟）通过任务 API 创建；依据 OM demo-8b17e40' },
  { id: 'evt-d2', at: minutesAgo(210), kind: 'request', title: '发起待决事项：补充送检日期', requestId: 'DR-2014' },
  { id: 'evt-d3', at: minutesAgo(150), kind: 'request', title: '发起待决事项：额定参数偏差判断', requestId: 'DR-2019' },
  { id: 'evt-d4', at: minutesAgo(35), kind: 'agent', title: '继续第 1、2 项材料核对' }],

  results: [{ id: 'res-d1', title: '送检登记完整性检查', status: 'draft', detail: '除 S-12 外均完整', evidenceIds: ['ev-d1'] }],
  logs: [
  { id: 'log-d1', at: minutesAgo(235), tool: 'certlab.get_document', call: '读取 DOC-2210 v2', receipt: '读取成功', receiptStatus: 'confirmed' },
  { id: 'log-d2', at: minutesAgo(155), tool: 'certlab.get_document', call: '读取 DOC-2231 v1', receipt: '读取成功', receiptStatus: 'confirmed' }],

  cancellation: null
},
{
  id: 'EX-91BD57',
  projectId: 'p-charger',
  ownerId: 'u-wang',
  goal: '证据完整性检查 · 申请批次 A-07',
  scope: '认证申请 DEMO-APP-0031 第 1–6 项证据材料',
  source: { system: 'CertLab（模拟）', ref: 'DEMO-APP-0031', label: '认证申请 DEMO-APP-0031' },
  omRepo: 'demo-org/airic-om',
  omCommit: 'demo-c02d9fe',
  runtimeVersion: 'Pi Durable（演示标识 rt-demo-1）',
  skillVersion: 'airic-work-skill demo-0.3',
  startedAt: minutesAgo(2880),
  updatedAt: minutesAgo(1440),
  lastSyncedAt: minutesAgo(1440),
  ended: true,
  summary: { doing: [], waiting: [], canContinue: [] },
  events: [
  { id: 'evt-c1', at: minutesAgo(2880), kind: 'system', title: '执行由业务系统发起' },
  { id: 'evt-c2', at: minutesAgo(1500), kind: 'receipt', title: '核对结论已写入业务系统草稿区', detail: '业务系统回执 RC-5521' },
  { id: 'evt-c3', at: minutesAgo(1440), kind: 'system', title: 'Agent 执行已结束', detail: '业务完成状态以业务系统为准' }],

  results: [
  { id: 'res-c1', title: '第 1–6 项核对结论（已写入草稿区）', status: 'confirmed', detail: '业务系统回执 RC-5521' },
  { id: 'res-c2', title: '评估发现草稿', status: 'draft', detail: '等待业务人员审阅' }],

  logs: [
  { id: 'log-c1', at: minutesAgo(1500), tool: 'certlab.write_findings', call: '写入第 1–6 项核对结论（草稿区）', receipt: 'RC-5521', receiptStatus: 'confirmed' }],

  cancellation: null
},
{
  id: 'EX-A40F19',
  projectId: 'p-device',
  ownerId: 'u-zhang',
  goal: '资料核对 · 注册申报目录',
  scope: '注册申报 DEMO-REG-0103 的申报目录完整性',
  source: { system: 'RegDesk（模拟）', ref: 'DEMO-REG-0103', label: '注册申报 DEMO-REG-0103' },
  omRepo: 'demo-org/airic-om',
  omCommit: 'demo-5d70b88',
  runtimeVersion: 'Pi Durable（演示标识 rt-demo-2）',
  skillVersion: 'airic-work-skill demo-0.4',
  startedAt: minutesAgo(3),
  updatedAt: minutesAgo(3),
  lastSyncedAt: minutesAgo(1),
  ended: false,
  summary: { doing: [], waiting: [], canContinue: [] },
  events: [{ id: 'evt-e1', at: minutesAgo(3), kind: 'system', title: '执行由业务系统发起', detail: 'RegDesk（模拟）通过任务 API 创建' }],
  results: [],
  logs: [],
  cancellation: null
}];