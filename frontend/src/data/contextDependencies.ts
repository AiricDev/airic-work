import type { ContextDependency } from '../types/platform';

export const contextDependencies: ContextDependency[] = [
/* DR-1047 例外材料有效性判断 */
{
  id: 'CD-1047-1',
  requestId: 'DR-1047',
  name: '第 4.2 项报告正文',
  kind: '文档',
  source: 'CertLab（模拟）DOC-1190',
  version: 'v1（译本）',
  status: '就绪',
  impact: '用于核对报告编号与样品型号',
  evidenceId: 'ev-a1'
},
{
  id: 'CD-1047-2',
  requestId: 'DR-1047',
  name: '原件签章页',
  kind: '文档',
  source: '申请人尚未提交',
  status: '缺失',
  impact: '影响“可追溯至原件”判断；第 4.2 项结论等待，其他项可继续'
},
{
  id: 'CD-1047-3',
  requestId: 'DR-1047',
  name: '测试日期时实验室认可状态',
  kind: '业务事实',
  source: '无权威来源',
  status: '缺失',
  impact: '影响 Agent 建议的不确定性',
  afterUpdate: { status: '待核实', note: '申请人补充上传认可证书扫描件；原件未核验', evidenceId: 'ev-a3', version: 'DOC-1204 v1' }
},
{
  id: 'CD-1047-4',
  requestId: 'DR-1047',
  name: '申请材料清单第 4.2 项标记',
  kind: '业务事实',
  source: 'CertLab（模拟）DOC-1182',
  version: 'v3',
  status: '就绪',
  impact: '确认该项被申请人标为例外材料',
  evidenceId: 'ev-a2'
},
{
  id: 'CD-1047-5',
  requestId: 'DR-1047',
  name: '例外材料判断方法',
  kind: '规则',
  source: 'OM 文件 decisions/evidence/exception-material.md',
  version: 'demo-3f9a2c1（执行固定版本）',
  status: '就绪',
  impact: '要求例外材料可追溯至原件',
  omPath: 'decisions/evidence/exception-material.md'
},
{
  id: 'CD-1047-6',
  requestId: 'DR-1047',
  name: '申请人资质核对（既往决定）',
  kind: '既往决定',
  source: 'DR-1031 UserDecision',
  status: '就绪',
  impact: '确认申请人资质有效，不影响本项判断',
  priorRequestId: 'DR-1031'
},
/* DR-1052 写入授权 */
{
  id: 'CD-1052-1',
  requestId: 'DR-1052',
  name: '第 1–3 项核对表',
  kind: '文档',
  source: 'Airic Work 执行产物 ART-0042-01',
  version: 'r2',
  status: '就绪',
  impact: '写入内容来源',
  evidenceId: 'ev-a4'
},
{
  id: 'CD-1052-2',
  requestId: 'DR-1052',
  name: '张敏的 CertLab 业务身份映射',
  kind: '授权',
  source: 'CertLab（模拟）身份信息',
  status: '就绪',
  impact: '写入须以归属人用户有效身份执行；失效时写入被阻止',
  delegationSystem: 'CertLab（模拟）'
},
{
  id: 'CD-1052-3',
  requestId: 'DR-1052',
  name: '业务写入授权方法',
  kind: '规则',
  source: 'OM 文件 decisions/operations/write-authorization.md',
  version: 'demo-3f9a2c1（执行固定版本）',
  status: '就绪',
  impact: '要求指定对象、动作与范围的人工授权',
  omPath: 'decisions/operations/write-authorization.md'
},
/* DR-1031 资质核对（已处理） */
{
  id: 'CD-1031-1',
  requestId: 'DR-1031',
  name: '执照副本换发日期',
  kind: '业务事实',
  source: 'CertLab（模拟）DOC-1182',
  version: 'v3',
  status: '就绪',
  impact: '与公开信息比对',
  evidenceId: 'ev-a2'
},
{
  id: 'CD-1031-2',
  requestId: 'DR-1031',
  name: '登记机关最新换发记录',
  kind: '业务事实',
  source: '无可用领域能力',
  status: '无访问权',
  impact: '无法自动确认，需人工补充事实'
},
/* DR-2014 送检日期 */
{
  id: 'CD-2014-1',
  requestId: 'DR-2014',
  name: '样品送检登记表',
  kind: '文档',
  source: 'CertLab（模拟）DOC-2210',
  version: 'v2',
  status: '就绪',
  impact: 'S-11、S-13 日期完整',
  evidenceId: 'ev-d1'
},
{
  id: 'CD-2014-2',
  requestId: 'DR-2014',
  name: 'S-12 实际送检日期',
  kind: '业务事实',
  source: '登记表中为空',
  status: '缺失',
  impact: '仅阻塞 S-12 送检时效核对'
},
/* DR-2019 额定参数 */
{
  id: 'CD-2019-1',
  requestId: 'DR-2019',
  name: '额定参数检测报告',
  kind: '文档',
  source: 'CertLab（模拟）DOC-2231',
  version: 'v1',
  status: '就绪',
  impact: '记录实测偏差 +2.1%',
  evidenceId: 'ev-d2'
},
{
  id: 'CD-2019-2',
  requestId: 'DR-2019',
  name: '测试环境温度记录',
  kind: '业务事实',
  source: '报告中未记录',
  status: '缺失',
  impact: '可能影响偏差解释'
},
{
  id: 'CD-2019-3',
  requestId: 'DR-2019',
  name: '适用标准版本',
  kind: '规则',
  source: '申请时声明（未核实）',
  status: '待核实',
  impact: '决定允许偏差范围',
  omPath: 'decisions/parameters/rated-deviation.md'
}];
