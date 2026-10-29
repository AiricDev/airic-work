import type { DecisionRequest } from '../types/workbench';
import { minutesAgo } from '../utils/time';

export const decisionRequests: DecisionRequest[] = [
{
  id: 'DR-1031',
  executionId: 'EX-7F3A21',
  ownerId: 'u-zhang',
  question: '申请人提交的营业执照副本是否为最新版本？',
  kind: 'fact',
  waitingItem: '申请人资质核对',
  createdAt: minutesAgo(118),
  updatedAt: minutesAgo(96),
  version: 1,
  allowedActions: ['fact', 'investigation'],
  brief: {
    actionNeeded: '补充事实：确认营业执照副本是否为最新版本',
    trigger: '业务系统中的执照副本与公开登记信息的换发日期不一致，Agent 无法访问登记机关原始记录。',
    affected: ['申请人资质核对'],
    continuing: ['第 1–3 项材料核对'],
    recommendation: null,
    noRecommendationReason: '该事项需要事实确认，Agent 不对事实作推断。',
    facts: [{ text: '申请材料清单记录执照副本换发日期为 2026-03-12', evidenceId: 'ev-a2' }],
    assumptions: [],
    gaps: ['登记机关的最新换发记录'],
    options: [],
    evidenceIds: ['ev-a2'],
    decisionModel: { id: 'DM-QUAL-002', title: '申请人资质核对', path: 'decisions/qualification/license-check.md' },
    omCommit: 'demo-3f9a2c1',
    origin: 'Agent 在执行 EX-7F3A21 中发起'
  },
  status: 'resolved',
  resolution: {
    id: 'RS-0907',
    requestId: 'DR-1031',
    action: 'fact',
    content: '已在业务系统核对，营业执照副本为 2026-03 换发的最新版本。',
    source: 'CertLab 申请记录 DEMO-APP-0042 · 附件 3',
    actorId: 'u-zhang',
    actorName: '张敏',
    channel: '工作台',
    at: minutesAgo(96),
    basisVersion: 1,
    idempotencyKey: 'seed-0907'
  },
  followUp: { status: 'continued', message: '相关工作已继续：申请人资质核对', remaining: [], updatedAt: minutesAgo(94) },
  changes: [],
  contextUpdate: null
},
{
  id: 'DR-1047',
  executionId: 'EX-7F3A21',
  ownerId: 'u-zhang',
  question: '例外材料「境外实验室测试报告（译本）」能否作为第 4.2 项的有效证据？',
  kind: 'judgment',
  waitingItem: '第 4.2 项：例外材料是否可接受',
  createdAt: minutesAgo(40),
  updatedAt: minutesAgo(40),
  version: 1,
  allowedActions: ['judgment', 'fact', 'investigation'],
  brief: {
    actionNeeded: '作出专业判断：该例外材料能否作为第 4.2 项的有效证据',
    trigger: 'DM-EVID-007 要求例外材料可追溯至原件；本项仅提供译本，适用条件无法由 Agent 自行判定。',
    affected: ['第 4.2 项证据有效性结论', '评估发现草稿 §4'],
    continuing: ['第 5 项及之后的独立材料核对', '申请人基础信息复核'],
    recommendation: {
      optionId: 'opt-conditional',
      text: '建议「有条件接受：补充原件核对记录」',
      rationale:
      '报告编号、样品型号与申请记录一致；译本由申请人声明的翻译机构出具，但原件签章页缺失。依据 DM-EVID-007 中“例外材料需可追溯至原件”的判断方法。',
      uncertainty: '无法确认测试日期时该实验室是否处于认可有效期；译本与原件的一致性未逐页核对。'
    },
    facts: [
    { text: '报告编号 TR-2026-0815 与申请记录中的型式试验编号一致', evidenceId: 'ev-a1' },
    { text: '申请材料清单将第 4.2 项标记为“例外材料：境外实验室出具”', evidenceId: 'ev-a2' },
    { text: '译本末页未附原件签章页影印件', evidenceId: 'ev-a1' }],

    assumptions: ['假设译本内容与原件一致（未逐页核对）', '假设样品型号命名规则在两地实验室一致'],
    gaps: ['测试日期时实验室的认可状态', '原件签章页'],
    options: [
    {
      id: 'opt-accept',
      label: '接受为有效证据',
      description: '认可译本作为第 4.2 项的有效证据，继续形成该项核对结论。',
      risk: '若译本与原件存在差异，后续评估结论可能需要回溯。'
    },
    {
      id: 'opt-conditional',
      label: '有条件接受：补充原件核对记录',
      description: '暂认可译本，同时要求申请人补充原件签章页及核对记录。',
      risk: '第 4.2 项结论将继续等待补充材料，其余项目不受影响。'
    },
    {
      id: 'opt-reject',
      label: '不接受，要求重新提交',
      description: '译本不作为有效证据，要求提交原件或经认证的副本。',
      risk: '申请人需重新准备材料，整体周期可能延长。'
    }],

    evidenceIds: ['ev-a1', 'ev-a2'],
    decisionModel: { id: 'DM-EVID-007', title: '例外材料有效性判断', path: 'decisions/evidence/exception-material.md' },
    omCommit: 'demo-3f9a2c1',
    origin: 'Agent 在执行 EX-7F3A21 中发起'
  },
  status: 'pending',
  resolution: null,
  followUp: null,
  changes: [],
  contextUpdate: {
    source: 'CertLab（模拟）· 申请人补充上传',
    summary: '申请人补充上传实验室认可证书扫描件（DOC-1204 v1）',
    scope: '影响缺失 Context「测试日期时实验室的认可状态」及 Agent 建议的不确定性',
    addFacts: [{ text: '新上传的认可证书扫描件显示有效期覆盖测试日期（原件未核验）', evidenceId: 'ev-a3' }],
    addEvidenceIds: ['ev-a3'],
    removeGaps: ['测试日期时实验室的认可状态']
  }
},
{
  id: 'DR-1052',
  executionId: 'EX-7F3A21',
  ownerId: 'u-zhang',
  question: '是否授权 Agent 将第 1–3 项核对结果作为草稿写入业务系统？',
  kind: 'authorization',
  waitingItem: '第 1–3 项核对结果写入业务系统',
  createdAt: minutesAgo(60),
  updatedAt: minutesAgo(60),
  version: 1,
  allowedActions: ['authorization', 'investigation'],
  brief: {
    actionNeeded: '提供授权：允许 Agent 在指定范围内写入核对结果草稿',
    trigger: '写入业务系统属于外部副作用，OM 要求此类操作取得人工授权。',
    affected: ['第 1–3 项核对结果写入业务系统'],
    continuing: ['所有材料核对工作', '第 4.2 项判断（独立请求）'],
    recommendation: null,
    noRecommendationReason: '是否授权由你负责决定，Agent 不就此给出建议。',
    facts: [{ text: '第 1–3 项核对已完成，核对表已生成', evidenceId: 'ev-a4' }],
    assumptions: [],
    gaps: [],
    options: [],
    evidenceIds: ['ev-a4'],
    decisionModel: { id: 'DM-OPS-011', title: '业务写入授权', path: 'decisions/operations/write-authorization.md' },
    omCommit: 'demo-3f9a2c1',
    origin: 'Agent 在执行 EX-7F3A21 中发起',
    authorization: {
      object: '业务记录 DEMO-APP-0042 · 评估发现（草稿区）',
      action: '写入第 1–3 项核对结果草稿，不提交审批',
      scope: '仅第 1–3 项；不含第 4.2 项及之后的任何结论',
      note: '业务系统仍会执行自身的写入校验；此授权不替代业务系统正式审批。'
    }
  },
  status: 'pending',
  resolution: null,
  followUp: null,
  changes: [],
  contextUpdate: null
},
{
  id: 'DR-2014',
  executionId: 'EX-5E12C8',
  ownerId: 'u-zhang',
  question: '请补充样品 S-12 的实际送检日期',
  kind: 'fact',
  waitingItem: '样品 S-12 送检时效核对',
  createdAt: minutesAgo(210),
  updatedAt: minutesAgo(210),
  version: 1,
  allowedActions: ['fact', 'investigation'],
  brief: {
    actionNeeded: '补充事实：样品 S-12 的实际送检日期',
    trigger: '送检登记表中 S-12 的日期栏为空，无法判断是否在规定时效内送检。',
    affected: ['样品 S-12 送检时效核对'],
    continuing: ['第 1、2 项材料核对', '第 4 项绝缘测试报告核对'],
    recommendation: null,
    noRecommendationReason: '缺少事实信息，Agent 不推测日期。',
    facts: [{ text: '送检登记表 v2 中 S-11、S-13 均有送检日期，S-12 为空', evidenceId: 'ev-d1' }],
    assumptions: [],
    gaps: ['S-12 实际送检日期'],
    options: [],
    evidenceIds: ['ev-d1'],
    decisionModel: { id: 'DM-SAMP-004', title: '送检时效核对', path: 'decisions/sampling/timeliness.md' },
    omCommit: 'demo-3f9a2c1',
    origin: 'Agent 在执行 EX-5E12C8 中发起'
  },
  status: 'pending',
  resolution: null,
  followUp: null,
  changes: [],
  contextUpdate: null
},
{
  id: 'DR-2019',
  executionId: 'EX-5E12C8',
  ownerId: 'u-zhang',
  question: '额定电流偏差 +2.1% 是否在可接受范围内？',
  kind: 'judgment',
  waitingItem: '第 3 项额定参数偏差判断',
  createdAt: minutesAgo(150),
  updatedAt: minutesAgo(150),
  version: 1,
  allowedActions: ['judgment', 'fact', 'investigation'],
  brief: {
    actionNeeded: '作出专业判断：额定电流偏差是否可接受',
    trigger: '偏差接近标准允许上限，且测试环境温度记录缺失，超出 Agent 可自行判定的适用边界。',
    affected: ['第 3 项额定参数结论'],
    continuing: ['第 4 项绝缘测试报告核对'],
    recommendation: {
      optionId: 'opt-within',
      text: '建议「在可接受范围内」',
      rationale: '适用标准允许 ±3% 偏差（依据 DM-PARA-002 引用的标准条款）。',
      uncertainty: '测试环境温度记录缺失，可能影响偏差解释。'
    },
    facts: [{ text: '检测报告记录额定电流实测偏差 +2.1%', evidenceId: 'ev-d2' }],
    assumptions: ['假设适用标准版本为申请时声明的版本'],
    gaps: ['测试环境温度记录'],
    options: [
    { id: 'opt-within', label: '在可接受范围内', description: '认可该偏差，形成第 3 项结论。', risk: '若温度条件异常，结论可能需要复核。' },
    { id: 'opt-retest', label: '要求补充环境条件或复测', description: '暂不形成结论，请申请人补充温度记录或复测。', risk: '第 3 项将继续等待。' }],

    evidenceIds: ['ev-d2'],
    decisionModel: { id: 'DM-PARA-002', title: '额定参数偏差判断', path: 'decisions/parameters/rated-deviation.md' },
    omCommit: 'demo-3f9a2c1',
    origin: 'Agent 在执行 EX-5E12C8 中发起'
  },
  status: 'pending',
  resolution: null,
  followUp: null,
  changes: [],
  contextUpdate: null
}];