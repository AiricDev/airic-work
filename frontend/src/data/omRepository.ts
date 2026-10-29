import type { GitCommit, OMSourceConfig } from '../types/platform';
import { minutesAgo } from '../utils/time';

/** The single OM repository configured for this Airic Work instance (fictional demo). */
export const seedOMSource: OMSourceConfig = {
  hostType: 'GitHub（演示）',
  repo: 'demo-org/airic-om',
  repoUrl: 'https://git.example.invalid/demo-org/airic-om',
  branch: 'main',
  credentialRef: 'secret-ref://demo/git-readonly'
};

const readmeV1 = `# 示例组织 OM（虚构）

本仓库是 Airic Work 演示实例唯一配置的 OM 来源。所有内容均为虚构，不对应任何真实认证或注册规则。

- 入口：[Root OM](root.md)
- 判断文件位于 \`decisions/\` 目录
- 验证材料位于 \`validation/\` 目录

修改请在 Git 平台提交 PR，经 Review 合并后，由平台同步供**未来新执行**使用。
`;

const readmeV2 = `${readmeV1}
## 外部协作

外部 Agent 可在授权范围内通过只读 MCP 读取 Trajectory 与 Decision Episode，在本地使用 OME 方法分析和修改本仓库。平台不运行反思或学习流程。
`;

const rootV1 = `# Root OM：产品认证证据核对（虚构）

## 工作范围

认证申请中证据材料的完整性检查、有效性判断，以及核对结果写入业务系统草稿区。不包含正式评估结论与审批。

## Decision Routing

| 触发情境 | 判断文件 |
| --- | --- |
| 证据材料存在例外标记 | [例外材料有效性判断](decisions/evidence/exception-material.md) |
| 申请人资质信息不一致 | [申请人资质核对](decisions/qualification/license-check.md) |
| 需要写入业务系统 | [业务写入授权](decisions/operations/write-authorization.md) |

## 领域能力依赖

- \`certlab.get_application\` / \`certlab.get_document\`：读取
- \`certlab.write_findings\`：仅草稿区写入，需人工授权
- 登记机关记录查询：**当前无可用能力**（缺口）
`;

const rootV2 = rootV1.replace(
  '| 需要写入业务系统 | [业务写入授权](decisions/operations/write-authorization.md) |',
  `| 需要写入业务系统 | [业务写入授权](decisions/operations/write-authorization.md) |
| 送检登记缺失或超期 | [送检时效核对](decisions/sampling/timeliness.md) |
| 额定参数偏差接近允许上限 | [额定参数偏差判断](decisions/parameters/rated-deviation.md) |`
);

const rootV3 = rootV2.replace(
  '| 额定参数偏差接近允许上限 | [额定参数偏差判断](decisions/parameters/rated-deviation.md) |',
  `| 额定参数偏差接近允许上限 | [额定参数偏差判断](decisions/parameters/rated-deviation.md) |
| 注册申报目录缺项 | [申报目录完整性判断](decisions/registration/dossier-completeness.md) |`
);

const exceptionV1 = `# DM-EVID-007 例外材料有效性判断

## Question

被申请人标记为“例外材料”的证据，能否作为对应检查项的有效证据？

## Trigger / Applicability

申请材料清单将某项标记为例外材料（如境外实验室出具、译本、扫描件）。

## Context Dependencies

- 申请材料清单中该项的标记与备注
- 例外材料正文及其版本
- 出具机构在测试日期时的认可状态

## Judgment

比较例外材料中的关键标识（报告编号、样品型号）与申请记录是否一致；不一致时不得接受。

## Outcomes

| 结论 | 后续含义 |
| --- | --- |
| 接受 | 形成该项核对结论 |
| 有条件接受 | 结论等待补充材料，其他项继续 |
| 不接受 | 要求重新提交 |

## Knowledge Gaps

- 译本与原件一致性的核对方法尚未明确
`;

const exceptionV2 = exceptionV1.
replace(
  '比较例外材料中的关键标识（报告编号、样品型号）与申请记录是否一致；不一致时不得接受。',
  `比较例外材料中的关键标识（报告编号、样品型号）与申请记录是否一致；不一致时不得接受。

例外材料**需可追溯至原件**：仅有译本且缺原件签章页时，不由 Agent 自行接受，应请求专业判断。`
).
replace('- 出具机构在测试日期时的认可状态', '- 出具机构在测试日期时的认可状态\n- 原件签章页或原件核对记录');

const licenseV1 = `# DM-QUAL-002 申请人资质核对

## Question

申请人提交的营业执照等资质文件是否为当前有效版本？

## Context Dependencies

- 业务系统中的资质文件及换发日期
- 公开登记信息（如可取得）

## Judgment

资质文件信息与公开登记信息不一致时，Agent 不推断哪一方正确，应请求事实补充。

## Precedents

- 2026 年演示案例：执照换发日期不一致，经人工补充事实确认为最新版本。
`;

const licenseV2 = licenseV1.replace(
  '资质文件信息与公开登记信息不一致时，Agent 不推断哪一方正确，应请求事实补充。',
  `资质文件信息与公开登记信息不一致时，Agent 不推断哪一方正确。

若登记机关记录查询能力可用，先查询登记记录；仍无法确认时再请求事实补充。当前该能力为缺口，见 [Root OM](../../root.md)。`
);

const writeAuth = `# DM-OPS-011 业务写入授权

## Question

Agent 是否可以将核对结果写入业务系统？

## Judgment

任何业务写入均属外部副作用，须取得任务归属人在指定对象、动作与范围内的授权。授权不替代业务系统正式审批。

## Validation

- 写入结果以业务系统权威回执确认；未知结果不能当作成功。
`;

const timeliness = `# DM-SAMP-004 送检时效核对

## Question

样品是否在规定时效内送检？

## Judgment

送检日期缺失时，Agent 不推测日期，应请求事实补充；其他样品的核对可继续。
`;

const rated = `# DM-PARA-002 额定参数偏差判断

## Question

额定参数实测偏差是否在可接受范围内？

## Judgment

偏差接近允许上限，且环境条件记录缺失时，超出 Agent 自行判定的适用边界，应请求专业判断。

\`\`\`text
允许偏差：±3%（演示用虚构值）
\`\`\`
`;

const dossier = `# DM-REG-001 申报目录完整性判断

## Question

注册申报目录是否完整？

## Judgment

目录项缺失时列出缺失项及影响范围；不推断缺失材料的内容。
`;

const qualCases = `# DM-QUAL-002 验证材料

| 场景 | 方法 | 结果 | 限制 |
| --- | --- | --- | --- |
| 执照日期不一致 | 情景推演 | 按预期请求事实补充 | 未在真实 Runtime 运行 |
| 登记查询可用 | 模拟工具执行 | 先查询登记记录 | 查询能力为模拟 |

结构正确或一次推演成功不代表专业行为已稳定。
`;

const readmeV1Commit = '初版：Root OM 与证据核对判断';

export const omCommits: GitCommit[] = [
{
  sha: 'demo-1e4b7a0d92c3f8e6a051',
  parents: [],
  author: '陈立',
  at: minutesAgo(43200),
  message: readmeV1Commit,
  changes: [
  { path: 'README.md', status: 'added', content: readmeV1 },
  { path: 'root.md', status: 'added', content: rootV1 },
  { path: 'decisions/evidence/exception-material.md', status: 'added', content: exceptionV1 },
  { path: 'decisions/qualification/license-check.md', status: 'added', content: licenseV1 },
  { path: 'decisions/operations/write-authorization.md', status: 'added', content: writeAuth },
  { path: 'assets/review-flow.png', status: 'added', binary: { size: '84 KB', mime: 'image/png' } }]

},
{
  sha: 'demo-8b17e40c3a91f5d26e08',
  parents: ['demo-1e4b7a0d92c3f8e6a051'],
  author: '张敏',
  at: minutesAgo(10080),
  message: '新增送检时效与额定参数判断',
  changes: [
  { path: 'root.md', status: 'modified', content: rootV2 },
  { path: 'decisions/sampling/timeliness.md', status: 'added', content: timeliness },
  { path: 'decisions/parameters/rated-deviation.md', status: 'added', content: rated }]

},
{
  sha: 'demo-c02d9fe7a1b44e0d93c5',
  parents: ['demo-8b17e40c3a91f5d26e08'],
  author: '王芳',
  at: minutesAgo(6000),
  message: '新增注册申报目录预审判断',
  changes: [
  { path: 'root.md', status: 'modified', content: rootV3 },
  { path: 'decisions/registration/dossier-completeness.md', status: 'added', content: dossier }]

},
{
  sha: 'demo-3f9a2c1d07e5b8a3f912',
  parents: ['demo-c02d9fe7a1b44e0d93c5'],
  author: '张敏',
  at: minutesAgo(2000),
  message: '例外材料需可追溯至原件',
  changes: [{ path: 'decisions/evidence/exception-material.md', status: 'modified', content: exceptionV2 }]
},
{
  sha: 'demo-5d70b88e41a9c2f07b6d',
  parents: ['demo-3f9a2c1d07e5b8a3f912'],
  author: '外部专家（经 PR #18 合并）',
  at: minutesAgo(180),
  message: '资质核对先查询登记记录（合并 PR #18）\n\n变更描述来自 PR，不代表改进成效已被验证。',
  changes: [
  { path: 'decisions/qualification/license-check.md', status: 'modified', content: licenseV2 },
  { path: 'validation/qual-002-cases.md', status: 'added', content: qualCases }]

},
{
  sha: 'demo-a71c3e95b0d24f8817ce',
  parents: ['demo-5d70b88e41a9c2f07b6d'],
  author: '陈立',
  at: minutesAgo(25),
  message: 'README 补充外部协作说明',
  changes: [{ path: 'README.md', status: 'modified', content: readmeV2 }]
}];


/** Commit confirmed by the last successful sync in the seed data. The newest commit exists remotely but is not yet synced. */
export const seedConfirmedSha = 'demo-5d70b88e41a9c2f07b6d';