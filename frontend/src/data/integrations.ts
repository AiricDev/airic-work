import type {
  ApiCaller,
  BusinessConnection,
  DataPolicy,
  RuntimeCapability,
  SkillVersion,
  SyncRecord,
  TrajectoryMcpPolicy } from
'../types/platform';
import { minutesAgo } from '../utils/time';

export const seedSyncRecords: SyncRecord[] = [
{ id: 'SY-04', at: minutesAgo(170), status: '成功', sha: 'demo-5d70b88e41a9c2f07b6d', note: '已取得并确认来源分支最新提交；同步文件与提交历史' },
{ id: 'SY-03', at: minutesAgo(1990), status: '成功', sha: 'demo-3f9a2c1d07e5b8a3f912', note: '已确认来源分支最新提交' },
{ id: 'SY-02', at: minutesAgo(3100), status: '失败', note: '网络超时；保留最后成功同步 demo-c02d9fe7a1b4，未标为最新' },
{ id: 'SY-01', at: minutesAgo(5990), status: '成功', sha: 'demo-c02d9fe7a1b44e0d93c5', note: '已确认来源分支最新提交' }];


export const seedBusinessConnection: BusinessConnection = {
  sourceId: 'certlab-demo-01',
  displayName: 'CertLab（模拟）',
  jumpTemplate: '/business?ref={ref}',
  mcpEndpoint: 'mcp://certlab-demo.invalid/v1',
  identitySource: 'CertLab 用户目录（模拟）',
  credentialRef: 'secret-ref://demo/certlab-mcp-client'
};

export const seedTrajectoryMcpPolicy: TrajectoryMcpPolicy = {
  enabled: true,
  recordScope: '仅限调用用户本人有权查看的 Project 下的执行记录；不含业务原文',
  redaction: '个人联系方式等敏感字段脱敏；已清理与受限记录仅返回占位说明',
  pageSize: 5
};

export const businessCapabilities: string[] = [
'certlab.get_application（读取）',
'certlab.get_document（读取）',
'certlab.write_findings（草稿区写入，需按人授权）',
'certlab.send_notice（写入，回执语义未说明）'];


export const apiCallers: ApiCaller[] = [
{
  id: 'cl-int-demo',
  system: 'CertLab（模拟）',
  identityNote:
  '调用方身份代表集成系统本身；实际发起用户与执行归属人需来自可信身份来源并可验证，不能由请求自由填写 userId 冒用（协议 TBD）。',
  operations: ['创建执行', '查询执行', '请求取消执行', '查询 Decision Request', '提交决策处理结果'],
  recentAccess: [
  { at: minutesAgo(130), operation: '创建执行 EX-7F3A21', result: '已接受' },
  { at: minutesAgo(95), operation: '查询 Decision Request', result: '成功' },
  { at: minutesAgo(50), operation: '创建执行 EX-2C9E04', result: '已接受' }]

}];


export const runtimeCapabilities: RuntimeCapability[] = [
{ name: '文件读写（工作区）', category: '通用', status: '已验证', note: '演示环境验证记录 RV-01' },
{ name: 'Shell / 代码执行', category: '通用', status: '未验证', note: '目标 Runtime 能力说明未发布' },
{ name: '结构化数据处理', category: '通用', status: '已验证', note: '演示环境验证记录 RV-02' },
{ name: '常见文档处理（PDF / Office）', category: '通用', status: '未验证', note: '不能以本地 Agent 可用推定后台可用' },
{ name: 'Decision Request 与执行记录', category: '平台', status: '已验证', note: '本原型模拟' },
{ name: '登记机关记录查询', category: '领域（MCP）', status: '不可用', note: 'OM 文件中记录的领域依赖缺口，需由业务能力承接' }];


export const runtimeSkills: SkillVersion[] = [
{ name: 'Airic Work Skill', version: 'demo-0.4', role: '执行 OM 的标准方法（后台装配）', validation: '代表性 OM 回归：TBD' }];


export const externalMethods: SkillVersion[] = [
{ name: 'Airic Work Skill', version: 'demo-0.4', role: '执行 OM 的标准方法；也可在具备能力与权限的外部 Agent 中使用', validation: '代表性 OM 回归：TBD' },
{ name: 'OME Skill', version: 'demo-0.6', role: 'OM 构造、评审与持续改进；内含 Reflective Learning 模块，仅在外部环境中使用', validation: '外部环境验证，平台不记录' }];


export const dataPolicies: DataPolicy[] = [
{ title: 'Trajectory 与 Episode 保留', summary: '保留期限 TBD；中间推理草稿按策略清理，清理后仅保留占位。', source: '组织数据策略（待确认）' },
{ title: '敏感字段', summary: '个人联系方式等字段在轨迹中脱敏显示；受限记录仅显示存在性。', source: '组织数据策略（待确认）' },
{ title: '外部交付', summary: '只读轨迹 MCP 只交付授权范围内、经脱敏的记录与引用；不提供全量轨迹外发、令牌访问或业务原文。', source: '本原型提案' }];