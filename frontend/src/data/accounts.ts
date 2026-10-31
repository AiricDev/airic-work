import type { BusinessIdentity,Delegation,ExecutionOrigin } from '../types/platform';
import { minutesAgo } from '../utils/time';

const daysAhead = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const seedIdentities: BusinessIdentity[] = [
{ id: 'BI-01', userId: 'u-zhang', system: 'CertLab（模拟）', instance: 'certlab-demo-01', externalId: 'cl-user-20931', basis: 'CertLab 账号绑定回执（演示）', status: '已验证', verifiedAt: minutesAgo(20160) },
{ id: 'BI-02', userId: 'u-zhang', system: 'RegDesk（模拟）', instance: 'regdesk-demo-01', externalId: 'rd-7781', basis: '', status: '待验证' },
{ id: 'BI-03', userId: 'u-wang', system: 'CertLab（模拟）', instance: 'certlab-demo-01', externalId: 'cl-user-11804', basis: 'CertLab 账号绑定回执（演示）', status: '已验证', verifiedAt: minutesAgo(30000) }];


export const seedDelegations: Delegation[] = [
{ id: 'DG-01', userId: 'u-zhang', system: 'CertLab（模拟）', status: '有效', scope: '读取申请与证据；写入评估发现草稿区', expiresAt: daysAhead(30), lastVerifiedAt: minutesAgo(15) },
{ id: 'DG-02', userId: 'u-zhang', system: 'RegDesk（模拟）', status: '已过期', scope: '读取注册申报资料', expiresAt: minutesAgo(1440), lastVerifiedAt: minutesAgo(1500) },
{ id: 'DG-03', userId: 'u-wang', system: 'CertLab（模拟）', status: '有效', scope: '读取申请与证据', expiresAt: null, lastVerifiedAt: minutesAgo(300) }];


export const executionOrigins: ExecutionOrigin[] = [
{ executionId: 'EX-7F3A21', caller: 'cl-int-demo（CertLab 集成调用方）', initiatorId: 'u-zhang', technicalExecutor: 'Airic Work 后台 Agent（Pi Durable 演示）', scope: '申请 DEMO-APP-0042 第 1–5 项证据', lastVerifiedAt: minutesAgo(12) },
{ executionId: 'EX-2C9E04', caller: 'cl-int-demo（CertLab 集成调用方）', initiatorId: 'u-zhang', technicalExecutor: 'Airic Work 后台 Agent（Pi Durable 演示）', scope: '申请人基础信息', lastVerifiedAt: minutesAgo(5) },
{ executionId: 'EX-5E12C8', caller: 'cl-int-demo（CertLab 集成调用方）', initiatorId: 'u-wang', technicalExecutor: 'Airic Work 后台 Agent（Pi Durable 演示）', scope: '申请 DEMO-APP-0057 第 1–4 项证据', lastVerifiedAt: minutesAgo(35) },
{ executionId: 'EX-91BD57', caller: 'cl-int-demo（CertLab 集成调用方）', initiatorId: 'u-wang', technicalExecutor: 'Airic Work 后台 Agent（Pi Durable 演示）', scope: '申请 DEMO-APP-0031 第 1–6 项证据', lastVerifiedAt: minutesAgo(1440) },
{ executionId: 'EX-A40F19', caller: 'rd-int-demo（RegDesk 集成调用方）', initiatorId: 'u-zhang', technicalExecutor: 'Airic Work 后台 Agent（Pi Durable 演示）', scope: '注册申报 DEMO-REG-0103 目录', lastVerifiedAt: minutesAgo(3) }];
