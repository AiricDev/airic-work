import type { TrajectoryCoverage,TrajectoryEvent } from '../types/platform';
import { minutesAgo } from '../utils/time';

export const trajectoryEvents: TrajectoryEvent[] = [
{ id: 'T-001', executionId: 'EX-7F3A21', at: minutesAgo(130), type: 'system', summary: '执行由业务系统创建；启动前确认来源分支最新提交，固定 OM demo-3f9a2c1', confirmation: '权威回执', sensitivity: 'normal' },
{ id: 'T-002', executionId: 'EX-7F3A21', at: minutesAgo(128), type: 'action', summary: '以张敏的业务身份调用 certlab.get_application 查询申请', confirmation: 'Agent 描述', input: '{ "application": "DEMO-APP-0042" }', output: '返回 5 项证据材料清单', sensitivity: 'normal' },
{ id: 'T-003', executionId: 'EX-7F3A21', at: minutesAgo(127), type: 'receipt', summary: '业务系统读取回执：申请清单', confirmation: '权威回执', output: 'receipt RC-DEMO-3301', sensitivity: 'normal' },
{ id: 'T-004', executionId: 'EX-7F3A21', at: minutesAgo(120), type: 'observation', summary: '执照副本换发日期与公开信息不一致', requestId: 'DR-1031', confirmation: 'Agent 描述', sensitivity: 'normal', evidenceIds: ['ev-a2'], episodeId: 'EP-0047' },
{ id: 'T-005', executionId: 'EX-7F3A21', at: minutesAgo(118), type: 'request', summary: '发起 DR-1031：营业执照版本确认', requestId: 'DR-1031', confirmation: '权威回执', sensitivity: 'normal', episodeId: 'EP-0047' },
{ id: 'T-006', executionId: 'EX-7F3A21', at: minutesAgo(96), type: 'intervention', summary: '张敏 补充事实：营业执照为最新版本', requestId: 'DR-1031', confirmation: '人工记录', input: '来源：CertLab 申请记录 · 附件 3', sensitivity: 'normal', episodeId: 'EP-0047' },
{ id: 'T-007', executionId: 'EX-7F3A21', at: minutesAgo(94), type: 'action', summary: '依据人工事实继续申请人资质核对', requestId: 'DR-1031', confirmation: 'Agent 描述', sensitivity: 'normal', episodeId: 'EP-0047' },
{ id: 'T-008', executionId: 'EX-7F3A21', at: minutesAgo(90), type: 'action', summary: '读取申请人联系人信息', confirmation: 'Agent 描述', input: '[已脱敏：个人联系方式]', output: '[已脱敏]', sensitivity: 'redacted' },
{ id: 'T-009', executionId: 'EX-7F3A21', at: minutesAgo(70), type: 'receipt', summary: '第 1–3 项材料读取回执', confirmation: '权威回执', sensitivity: 'normal', evidenceIds: ['ev-a4'] },
{ id: 'T-010', executionId: 'EX-7F3A21', at: minutesAgo(55), type: 'observation', summary: '中间推理草稿（已按保留政策清理）', confirmation: '未确认', sensitivity: 'purged' },
{ id: 'T-011', executionId: 'EX-7F3A21', at: minutesAgo(42), type: 'observation', summary: '第 4.2 项为境外实验室译本，缺原件签章页', requestId: 'DR-1047', confirmation: 'Agent 描述', sensitivity: 'normal', evidenceIds: ['ev-a1', 'ev-a2'] },
{ id: 'T-012', executionId: 'EX-7F3A21', at: minutesAgo(41), type: 'action', summary: '调用 certlab.send_notice 发送补件提醒', confirmation: '未确认', input: '{ "item": "4.2", "type": "原件补交" }', output: '未收到回执', sensitivity: 'normal' },
{ id: 'T-013', executionId: 'EX-7F3A21', at: minutesAgo(40), type: 'request', summary: '发起 DR-1047：例外材料有效性判断', requestId: 'DR-1047', confirmation: '权威回执', sensitivity: 'normal' },
{ id: 'T-014', executionId: 'EX-7F3A21', at: minutesAgo(30), type: 'observation', summary: '受限记录：申请人商业信息', confirmation: '未确认', sensitivity: 'restricted' },
{ id: 'T-015', executionId: 'EX-7F3A21', at: minutesAgo(12), type: 'action', summary: '开始核对第 5 项型式试验报告', confirmation: 'Agent 描述', sensitivity: 'normal' },
{ id: 'T-101', executionId: 'EX-5E12C8', at: minutesAgo(240), type: 'system', summary: '执行由业务系统创建；启动前确认来源分支最新提交，固定 OM demo-3f9a2c1', confirmation: '权威回执', sensitivity: 'normal' },
{ id: 'T-102', executionId: 'EX-5E12C8', at: minutesAgo(212), type: 'observation', summary: 'S-12 送检日期为空', requestId: 'DR-2014', confirmation: 'Agent 描述', sensitivity: 'normal', evidenceIds: ['ev-d1'] },
{ id: 'T-103', executionId: 'EX-5E12C8', at: minutesAgo(152), type: 'observation', summary: '额定电流偏差 +2.1%，环境温度未记录', requestId: 'DR-2019', confirmation: 'Agent 描述', sensitivity: 'normal', evidenceIds: ['ev-d2'] }];


export const trajectoryCoverage: TrajectoryCoverage[] = [
{ executionId: 'EX-7F3A21', gapFromMinutesAgo: 85, gapToMinutesAgo: 60, gapNote: '85–60 分钟前的事件因上下文压缩未保留（模拟）' },
{ executionId: 'EX-5E12C8', gapFromMinutesAgo: 200, gapToMinutesAgo: 160, gapNote: '200–160 分钟前的事件因上下文压缩未保留（模拟）' }];
