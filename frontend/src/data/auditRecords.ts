import type { AuditRecord } from '../types/platform';
import { minutesAgo } from '../utils/time';

export const seedAuditRecords: AuditRecord[] = [
{ id: 'AU-007', at: minutesAgo(300), actorName: 'Claude Code（张敏本地，演示）', action: '外部只读读取', target: 'Decision Episode EP-0047', result: '成功', summary: '代表 张敏；含证据限制说明，未交付业务原文' },
{ id: 'AU-006', at: minutesAgo(1500), actorName: 'Codex（张敏，演示）', action: '外部只读读取', target: 'Trajectory EX-7F3A21', result: '已阻止', summary: '客户端授权已过期' },
{ id: 'AU-005', at: minutesAgo(3100), actorName: '系统', action: '同步 OM 来源', target: 'demo-org/airic-om@main', result: '失败', summary: '网络超时；保留最后成功同步，未标为最新' },
{ id: 'AU-004', at: minutesAgo(2000), actorName: '陈立', action: '停用用户', target: '赵强', result: '成功', summary: '无待交接责任；历史处理记录保留' },
{ id: 'AU-003', at: minutesAgo(4400), actorName: '陈立', action: '测试业务连接', target: 'CertLab（模拟）', result: '成功', summary: '读取能力可用；未执行业务写入' },
{ id: 'AU-002', at: minutesAgo(4500), actorName: '陈立', action: '修改 Git 连接', target: 'demo-org/airic-om', result: '成功', summary: '凭据引用更新为 secret-ref://demo/git-readonly（不显示秘密值）' },
{ id: 'AU-001', at: minutesAgo(20160), actorName: '陈立', action: '建立业务身份映射', target: '张敏 ↔ CertLab cl-user-20931', result: '成功', summary: '依据：CertLab 账号绑定回执（演示）' }];