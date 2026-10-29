import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { DemoUser } from '../types/workbench';
import type {
  ActionResult,
  AppNotification,
  AuditRecord,
  BusinessConnection,
  BusinessIdentity,
  Delegation,
  ExternalClientGrant,
  GeneralSettings,
  McpReadLog,
  McpResource,
  OMSourceConfig,
  OMSyncState,
  PlatformDemoSettings,
  StartCheck,
  SyncRecord,
  TestResult,
  TrajectoryMcpPolicy,
  UserPreference } from
'../types/platform';
import { demoUsers } from '../data/users';
import { seedIdentities, seedDelegations } from '../data/accounts';
import { seedBusinessConnection, seedSyncRecords, seedTrajectoryMcpPolicy } from '../data/integrations';
import { seedNotifications } from '../data/notifications';
import { seedAuditRecords } from '../data/auditRecords';
import { seedClientGrants, seedReadLogs } from '../data/externalClients';
import { omCommits, seedConfirmedSha, seedOMSource } from '../data/omRepository';
import { useWorkbench } from './WorkbenchContext';
import { createId } from '../utils/decisionService';
import { nowIso, minutesAgo } from '../utils/time';
import { shortSha } from '../utils/omRepository';

const KEY = 'airic-work-demo-platform-v2';

interface PlatformState {
  users: DemoUser[];
  identities: BusinessIdentity[];
  delegations: Delegation[];
  omSource: OMSourceConfig;
  omSync: OMSyncState;
  gitTest: TestResult | null;
  syncRecords: SyncRecord[];
  business: BusinessConnection;
  businessTest: TestResult | null;
  mcpPolicy: TrajectoryMcpPolicy;
  grants: ExternalClientGrant[];
  readLogs: McpReadLog[];
  general: GeneralSettings;
  preferences: Record<string, UserPreference>;
  notifications: AppNotification[];
  audit: AuditRecord[];
  demo: PlatformDemoSettings;
  signedOut: boolean;
}

export interface Responsibilities {
  executions: number;
  requests: number;
}

export interface McpReadRequest {
  grantId: string;
  resource: McpResource;
  executionId: string;
  page: number;
}

const defaultPreference: UserPreference = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  notify: { decision: true, anomaly: true, result: true }
};

const newestSha = omCommits[omCommits.length - 1].sha;

function createInitial(): PlatformState {
  return {
    users: JSON.parse(JSON.stringify(demoUsers)),
    identities: [...seedIdentities],
    delegations: [...seedDelegations],
    omSource: { ...seedOMSource },
    omSync: { latestConfirmedSha: seedConfirmedSha, lastSuccessAt: minutesAgo(170), lastAttempt: { at: minutesAgo(170), status: 'success', note: '已确认来源分支最新提交' } },
    gitTest: null,
    syncRecords: [...seedSyncRecords],
    business: { ...seedBusinessConnection },
    businessTest: null,
    mcpPolicy: { ...seedTrajectoryMcpPolicy },
    grants: JSON.parse(JSON.stringify(seedClientGrants)),
    readLogs: [...seedReadLogs],
    general: { orgName: '示例组织（虚构）', timezone: 'Asia/Shanghai' },
    preferences: {},
    notifications: [...seedNotifications],
    audit: [...seedAuditRecords],
    demo: { gitSyncFail: false, trajectoryMissing: false, mcpReadDenied: false, connectionTestFailure: 'none' },
    signedOut: false
  };
}

function load(): PlatformState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...createInitial(), ...(JSON.parse(raw) as PlatformState) };
  } catch {

    // ignore corrupt demo storage
  }return createInitial();
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function grantActive(g: ExternalClientGrant): boolean {
  return g.status === '有效' && (!g.expiresAt || new Date(g.expiresAt).getTime() > Date.now());
}

function useProvidePlatform() {
  const { currentUser, state: wb } = useWorkbench();
  const [state, setState] = useState<PlatformState>(load);
  const ref = useRef(state);
  ref.current = state;
  const wbRef = useRef(wb);
  wbRef.current = wb;
  const scheduled = useRef(new Set<string>());

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  const account = state.users.find((u) => u.id === currentUser.id) ?? currentUser;
  const isAdmin = account.systemRole === 'admin' && account.status === 'active';

  const audit = useCallback(
    (action: string, target: string, result: AuditRecord['result'], summary: string, actor?: string) =>
    setState((s) => ({ ...s, audit: [{ id: createId('AU'), at: nowIso(), actorName: actor ?? account.name, action, target, result, summary }, ...s.audit] })),
    [account.name]
  );

  const denied: ActionResult = { ok: false, message: '需要有效的管理员身份；服务已拒绝该操作。' };

  /* ---------- OM source sync ---------- */
  const finishSync = (s: PlatformState): PlatformState => {
    const at = nowIso();
    const target = `${s.omSource.repo}@${s.omSource.branch}`;
    if (s.demo.gitSyncFail) {
      return {
        ...s,
        omSync: { ...s.omSync, lastAttempt: { at, status: 'failed', note: '同步失败：网络超时（模拟）。保留最后成功同步，不能标为最新。' } },
        syncRecords: [{ id: createId('SY'), at, status: '失败', note: `同步失败：网络超时；保留 ${shortSha(s.omSync.latestConfirmedSha)}，未标为最新` }, ...s.syncRecords],
        audit: [{ id: createId('AU'), at, actorName: '系统', action: '同步 OM 来源', target, result: '失败', summary: '网络超时；保留最后成功同步' }, ...s.audit]
      };
    }
    const changed = s.omSync.latestConfirmedSha !== newestSha;
    return {
      ...s,
      omSync: { latestConfirmedSha: newestSha, lastSuccessAt: at, lastAttempt: { at, status: 'success', note: changed ? `已确认最新提交 ${shortSha(newestSha)}` : '已确认最新；来源分支无新提交' } },
      syncRecords: [{ id: createId('SY'), at, status: '成功', sha: newestSha, note: changed ? '已取得并确认来源分支最新提交；既有执行保持原 SHA' : '已确认最新；无新提交' }, ...s.syncRecords],
      audit: [{ id: createId('AU'), at, actorName: '系统', action: '同步 OM 来源', target, result: '成功', summary: `最新确认 ${shortSha(newestSha)}` }, ...s.audit]
    };
  };

  useEffect(() => {
    const att = state.omSync.lastAttempt;
    const key = `sync-${att?.at}`;
    if (att?.status === 'accepted' && !scheduled.current.has(key)) {
      scheduled.current.add(key);
      window.setTimeout(() => {
        setState((s) => s.omSync.lastAttempt?.status === 'accepted' ? finishSync(s) : s);
      }, 2200);
    }
  }, [state.omSync.lastAttempt]);

  const syncOM = useCallback((): ActionResult => {
    if (!isAdmin) return denied;
    if (ref.current.omSync.lastAttempt?.status === 'accepted') return { ok: false, message: '已有同步请求在进行中，请查询其结果，不重复发起。' };
    const at = nowIso();
    setState((s) => ({
      ...s,
      omSync: { ...s.omSync, lastAttempt: { at, status: 'accepted', note: '同步请求已记录，等待结果' } },
      syncRecords: [{ id: createId('SY'), at, status: '已接受', note: '同步请求已记录；不做语义索引' }, ...s.syncRecords]
    }));
    audit('同步 OM 来源', `${ref.current.omSource.repo}@${ref.current.omSource.branch}`, '成功', '同步请求已记录');
    return { ok: true, message: '同步请求已记录。请求被接受不等于已完成；结果见同步记录。' };
  }, [isAdmin, audit]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Called right before a new execution actually starts: fetch & confirm the latest source commit. */
  const checkLatestForStart = useCallback(async (): Promise<StartCheck> => {
    await wait(1200);
    let next: PlatformState = ref.current;
    setState((s) => {
      next = finishSync(s);
      return next;
    });
    await wait(0);
    const at = nowIso();
    if (ref.current.demo.gitSyncFail) {
      return { at, ok: false, message: '无法确认来源分支最新提交。执行请求已接受，但不会进入实际运行；不会使用旧缓存冒称最新。' };
    }
    return { at, ok: true, sha: newestSha, message: `已确认来源分支最新提交 ${shortSha(newestSha)}，新执行将固定使用该 SHA，启动后不随仓库变更切换。` };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runTest = async (kind: 'git' | 'business'): Promise<TestResult> => {
    await wait(1100);
    const mode = ref.current.demo.connectionTestFailure;
    const at = nowIso();
    if (mode === 'auth') return { at, ok: false, category: '认证', message: '凭据引用无法通过认证（模拟）。' };
    if (mode === 'network') return { at, ok: false, category: '网络', message: '连接超时，无法到达目标地址（模拟）。' };
    if (mode === 'capability') return { at, ok: false, category: '能力不可用', message: kind === 'git' ? '仓库可达，但缺少只读访问能力（模拟）。' : 'MCP 可达，但未发现所需能力（模拟）。' };
    return { at, ok: true, message: kind === 'git' ? '只读连接成功。仅代表连通，不代表已同步或已确认最新。' : '读取能力可用。未执行任何业务写入；连通不代表本人授权或业务操作权限。' };
  };

  const saveOMSource = useCallback(
    (src: OMSourceConfig): ActionResult => {
      if (!isAdmin) return denied;
      setState((s) => ({ ...s, omSource: src }));
      audit('修改 Git 连接', src.repo, '成功', `来源分支 ${src.branch}；凭据引用 ${src.credentialRef}`);
      return { ok: true, message: '已保存。需显式同步后才会确认来源分支最新提交；运行中执行的 SHA 不变，也不会自动启动执行。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const testGit = useCallback(async () => {
    const result = await runTest('git');
    setState((s) => ({ ...s, gitTest: result }));
    audit('测试 Git 连接', ref.current.omSource.repo, result.ok ? '成功' : '失败', result.message);
    return result;
  }, [audit]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBusiness = useCallback(
    (business: BusinessConnection): ActionResult => {
      if (!isAdmin) return denied;
      setState((s) => ({ ...s, business }));
      audit('修改业务连接', business.displayName, '成功', `MCP ${business.mcpEndpoint}；客户端配置引用 ${business.credentialRef}`);
      return { ok: true, message: '已保存。不会创建执行、写入业务状态或扩大任何用户的业务权限。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const testBusiness = useCallback(async () => {
    const result = await runTest('business');
    setState((s) => ({ ...s, businessTest: result }));
    audit('测试业务连接', ref.current.business.displayName, result.ok ? '成功' : '失败', result.message);
    return result;
  }, [audit]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveMcpPolicy = useCallback(
    (policy: TrajectoryMcpPolicy): ActionResult => {
      if (!isAdmin) return denied;
      setState((s) => ({ ...s, mcpPolicy: policy }));
      audit('修改只读轨迹 MCP 策略', '轨迹只读 MCP', '成功', `${policy.enabled ? '启用' : '停用'}；每页 ${policy.pageSize} 条`);
      return {
        ok: true,
        message: policy.enabled ?
        '已保存。配置不会自动授权任何客户端；每次读取仍校验本人授权与数据策略。' :
        '已保存。后续读取将被拒绝；已合法交付的内容无法追回。'
      };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const saveGeneral = useCallback(
    (general: GeneralSettings): ActionResult => {
      if (!isAdmin) return denied;
      setState((s) => ({ ...s, general }));
      audit('修改基本信息', general.orgName, '成功', `默认时区 ${general.timezone}`);
      return { ok: true, message: '已保存。组织显示名称不改变任何业务标识。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ---------- users ---------- */
  const createUser = useCallback(
    (input: {name: string;email: string;systemRole: DemoUser['systemRole'];status: DemoUser['status'];}): ActionResult => {
      if (!isAdmin) return denied;
      const email = input.email.trim().toLowerCase();
      if (ref.current.users.some((u) => u.email.toLowerCase() === email)) return { ok: false, message: '该登录标识已存在，未重复创建。' };
      const user: DemoUser = {
        id: createId('u'),
        name: input.name.trim(),
        role: input.systemRole === 'admin' ? '平台管理员' : '成员',
        email,
        systemRole: input.systemRole,
        status: input.status,
        lastLoginAt: null,
        visibleProjectIds: [],
        canRequestCancel: false
      };
      setState((s) => ({ ...s, users: [...s.users, user] }));
      audit('新增用户', user.name, '成功', `角色 ${input.systemRole === 'admin' ? '管理员' : '成员'}，状态 ${input.status === 'active' ? '有效' : '已停用'}；未关联业务身份`);
      return { ok: true, message: `已创建 ${user.name}。账户已生效，但业务身份尚未关联，业务授权也未完成。` };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const updateUserName = useCallback(
    (userId: string, name: string): ActionResult => {
      if (!isAdmin) return denied;
      if (!name.trim()) return { ok: false, message: '显示名不能为空。' };
      const user = ref.current.users.find((u) => u.id === userId);
      setState((s) => ({ ...s, users: s.users.map((u) => u.id === userId ? { ...u, name: name.trim() } : u) }));
      audit('编辑用户', user?.name ?? userId, '成功', `显示名 → ${name.trim()}；历史处理记录不改写`);
      return { ok: true, message: '已保存。历史处理记录中的姓名保持原样。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const activeAdmins = () => ref.current.users.filter((u) => u.systemRole === 'admin' && u.status === 'active');

  const changeRole = useCallback(
    (userId: string, role: DemoUser['systemRole']): ActionResult => {
      if (!isAdmin) return denied;
      const user = ref.current.users.find((u) => u.id === userId);
      if (!user) return { ok: false, message: '用户不存在。' };
      if (user.systemRole === 'admin' && role === 'member' && user.status === 'active' && activeAdmins().length <= 1) {
        audit('修改角色', user.name, '已阻止', '最后一个有效管理员不能降级');
        return { ok: false, message: '不能降级最后一个有效管理员。' };
      }
      setState((s) => ({ ...s, users: s.users.map((u) => u.id === userId ? { ...u, systemRole: role } : u) }));
      audit('修改角色', user.name, '成功', `${user.systemRole === 'admin' ? '管理员' : '成员'} → ${role === 'admin' ? '管理员' : '成员'}`);
      return { ok: true, message: `${user.name} 的角色已更新为${role === 'admin' ? '管理员' : '成员'}。业务对象权限不随之改变。` };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const setUserStatus = useCallback(
    (userId: string, status: DemoUser['status'], resp: Responsibilities): ActionResult => {
      if (!isAdmin) return denied;
      const user = ref.current.users.find((u) => u.id === userId);
      if (!user) return { ok: false, message: '用户不存在。' };
      if (status === 'disabled') {
        if (user.id === account.id) return { ok: false, message: '本轮不允许在管理页停用自己，以避免自锁。' };
        if (user.systemRole === 'admin' && activeAdmins().length <= 1) {
          audit('停用用户', user.name, '已阻止', '最后一个有效管理员');
          return { ok: false, message: '不能停用最后一个有效管理员。' };
        }
        if (resp.executions > 0 || resp.requests > 0) {
          audit('停用用户', user.name, '已阻止', `仍为 ${resp.executions} 个执行的归属人，${resp.requests} 个待处理请求`);
          return { ok: false, message: `${user.name} 仍是 ${resp.executions} 个进行中执行的唯一归属人，并有 ${resp.requests} 个待处理请求。需先按后续设计的责任交接流程处理，本轮不提供转派。` };
        }
      }
      setState((s) => ({ ...s, users: s.users.map((u) => u.id === userId ? { ...u, status } : u) }));
      audit(status === 'disabled' ? '停用用户' : '恢复用户', user.name, '成功', status === 'disabled' ? '历史处理记录、审计与轨迹保留' : '外部业务授权不自动恢复');
      return {
        ok: true,
        message:
        status === 'disabled' ?
        `${user.name} 已停用。历史记录保留；会话撤销与调用凭据联动尚未实现，不代表已完成。` :
        `${user.name} 已恢复。外部业务授权不会自动恢复，需本人重新授权。`
      };
    },
    [isAdmin, audit, account.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ---------- identities & delegations ---------- */
  const affectedByIdentity = (userId: string, system: string) =>
  wbRef.current.executions.filter((e) => e.ownerId === userId && e.source.system === system && !e.ended && e.cancellation?.status !== 'confirmed');

  const addIdentity = useCallback(
    (input: Omit<BusinessIdentity, 'id' | 'status' | 'verifiedAt'>): ActionResult => {
      if (!isAdmin) return denied;
      const s = ref.current;
      if (s.identities.some((i) => i.userId === input.userId && i.instance === input.instance)) {
        return { ok: false, message: '该用户在此业务系统实例已有映射，同一实例仅允许一个映射。' };
      }
      if (s.identities.some((i) => i.instance === input.instance && i.externalId === input.externalId)) {
        return { ok: false, message: '该外部身份已映射到其他平台用户。' };
      }
      setState((st) => ({ ...st, identities: [...st.identities, { ...input, id: createId('BI'), status: '待验证' }] }));
      const name = s.users.find((u) => u.id === input.userId)?.name ?? input.userId;
      audit('建立业务身份映射', `${name} ↔ ${input.system} ${input.externalId}`, '成功', '状态：待验证；不按同名或邮箱自动关联');
      return { ok: true, message: '映射已登记，状态为“待验证”。仅在业务系统可验证时生效。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const verifyIdentity = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!isAdmin) return denied;
      await wait(900);
      const ident = ref.current.identities.find((i) => i.id === id);
      if (!ident) return { ok: false, message: '映射不存在。' };
      if (!ident.basis.trim()) {
        audit('验证业务身份', ident.externalId, '失败', '缺少验证依据');
        return { ok: false, message: '业务系统目录无法验证：缺少验证依据，映射保持“待验证”。' };
      }
      setState((s) => ({ ...s, identities: s.identities.map((i) => i.id === id ? { ...i, status: '已验证', verifiedAt: nowIso() } : i) }));
      audit('验证业务身份', ident.externalId, '成功', `依据：${ident.basis}`);
      return { ok: true, message: '业务系统目录已验证该映射（模拟）。映射已验证不等于委托有效，也不等于拥有业务审批权限。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const removeIdentity = useCallback(
    (id: string): ActionResult => {
      if (!isAdmin) return denied;
      const ident = ref.current.identities.find((i) => i.id === id);
      if (!ident) return { ok: false, message: '映射不存在。' };
      const affected = affectedByIdentity(ident.userId, ident.system);
      if (affected.length > 0) {
        audit('移除业务身份映射', ident.externalId, '已阻止', `${affected.length} 个运行中执行代表该业务主体`);
        return { ok: false, message: `${affected.length} 个运行中执行正代表该业务主体（${affected.map((e) => e.id).join('、')}）。不能让运行中执行静默换人，操作已阻止。` };
      }
      setState((s) => ({ ...s, identities: s.identities.filter((i) => i.id !== id) }));
      audit('移除业务身份映射', ident.externalId, '成功', '无运行中执行受影响；历史主体记录不改写');
      return { ok: true, message: '映射已移除。历史执行中记录的业务主体不会被改写。' };
    },
    [isAdmin, audit] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const reauthorize = useCallback(async (id: string): Promise<ActionResult> => {
    await wait(900);
    const dg = ref.current.delegations.find((d) => d.id === id);
    if (!dg || dg.userId !== currentUser.id) return { ok: false, message: '只能由本人重新授权。' };
    setState((s) => ({
      ...s,
      delegations: s.delegations.map((d) =>
      d.id === id ? { ...d, status: '有效', expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), lastVerifiedAt: nowIso() } : d
      )
    }));
    return { ok: true, message: '已在业务系统完成重新授权（模拟），已核对为同一业务主体与范围。受影响工作需取得后续事件后才确认继续，不会盲目重放未知写入。' };
  }, [currentUser.id]);

  const testDelegation = useCallback(async (id: string): Promise<ActionResult> => {
    await wait(900);
    const dg = ref.current.delegations.find((d) => d.id === id);
    if (!dg) return { ok: false, message: '委托不存在。' };
    if (dg.status !== '有效') return { ok: false, message: `只读测试失败：委托${dg.status}（模拟）。` };
    setState((s) => ({ ...s, delegations: s.delegations.map((d) => d.id === id ? { ...d, lastVerifiedAt: nowIso() } : d) }));
    return { ok: true, message: '只读测试成功：可按本人身份读取授权范围内的业务对象（模拟）。这不代表目标业务操作有权。' };
  }, []);

  const revokeDelegation = useCallback((id: string): ActionResult => {
    setState((s) => ({ ...s, delegations: s.delegations.map((d) => d.id === id ? { ...d, status: '已撤销', lastVerifiedAt: nowIso() } : d) }));
    return { ok: true, message: '委托已撤销。后续依赖该委托的 MCP 操作将被阻止；已发生的业务效果不会回滚。' };
  }, []);

  const expireDelegation = useCallback((id: string) => {
    setState((s) => ({ ...s, delegations: s.delegations.map((d) => d.id === id ? { ...d, status: '已过期', expiresAt: nowIso() } : d) }));
  }, []);

  /* ---------- external read-only MCP ---------- */
  const renewGrant = useCallback(async (id: string): Promise<ActionResult> => {
    await wait(800);
    const g = ref.current.grants.find((x) => x.id === id);
    if (!g || g.userId !== currentUser.id) return { ok: false, message: '只能由本人授权自己的外部客户端。' };
    setState((s) => ({
      ...s,
      grants: s.grants.map((x) => x.id === id ? { ...x, status: '有效', grantedAt: nowIso(), expiresAt: new Date(Date.now() + 14 * 86400000).toISOString() } : x)
    }));
    return { ok: true, message: '已按原范围重新授权该客户端（模拟）。本人业务授权不会因此扩展。' };
  }, [currentUser.id]);

  const revokeGrant = useCallback(
    (id: string): ActionResult => {
      const g = ref.current.grants.find((x) => x.id === id);
      if (!g || g.userId !== currentUser.id) return { ok: false, message: '只能撤销自己的客户端授权。' };
      setState((s) => ({ ...s, grants: s.grants.map((x) => x.id === id ? { ...x, status: '已撤销' } : x) }));
      audit('撤销外部客户端授权', g.clientName, '成功', '后续读取将被拒绝；已合法交付的内容无法追回');
      return { ok: true, message: '已撤销。后续读取将被拒绝；已经合法交付的内容无法追回。' };
    },
    [currentUser.id, audit]
  );

  const mcpRead = useCallback(
    async (req: McpReadRequest): Promise<ActionResult> => {
      await wait(700);
      const s = ref.current;
      const g = s.grants.find((x) => x.id === req.grantId);
      const exec = wbRef.current.executions.find((e) => e.id === req.executionId);
      const resourceLabel = `${req.resource} ${req.executionId}${req.resource === 'Trajectory 分页' ? ` 第 ${req.page + 1} 页` : ''}`;
      let reason: string | null = null;
      if (!g || g.userId !== currentUser.id) reason = '客户端未获得本人授权';else
      if (!grantActive(g)) reason = `客户端授权${g.status === '有效' ? '已过期' : g.status}`;else
      if (!s.mcpPolicy.enabled) reason = '只读轨迹服务已由管理员停用';else
      if (s.demo.mcpReadDenied) reason = '数据策略拒绝本次读取（模拟）';else
      if (!g.resources.includes(req.resource)) reason = '请求的资源不在客户端授权范围内';else
      if (!exec || !g.projectIds.includes(exec.projectId) || !currentUser.visibleProjectIds.includes(exec.projectId)) reason = '无可读取记录或无权访问';
      const at = nowIso();
      const clientName = g?.clientName ?? '未知客户端';
      setState((st) => ({
        ...st,
        readLogs: [{ id: createId('RL'), at, clientName, userName: account.name, resource: resourceLabel, result: reason ? '已拒绝' : '已交付', note: reason ?? '仅交付授权范围内的脱敏记录与引用' }, ...st.readLogs],
        audit: [{ id: createId('AU'), at, actorName: clientName, action: '外部只读读取', target: resourceLabel, result: reason ? '已阻止' : '成功', summary: `代表 ${account.name}；${reason ?? '已交付脱敏记录'}` }, ...st.audit]
      }));
      if (reason) return { ok: false, message: `读取被拒绝：${reason}。拒绝不会泄漏对象是否存在或记录数量。` };
      return { ok: true, message: '读取成功（模拟）。返回内容已按数据策略脱敏，并附带缺失与限制说明。' };
    },
    [currentUser, account.name]
  );

  /* ---------- personal ---------- */
  const saveProfile = useCallback((name: string): ActionResult => {
    setState((s) => ({ ...s, users: s.users.map((u) => u.id === currentUser.id ? { ...u, name } : u) }));
    return { ok: true, message: '资料已保存。历史处理记录中的姓名保持原样。' };
  }, [currentUser.id]);

  const savePreference = useCallback((pref: UserPreference): ActionResult => {
    setState((s) => ({ ...s, preferences: { ...s.preferences, [currentUser.id]: pref } }));
    return { ok: true, message: '偏好已保存。通知偏好只影响提示，不隐藏待决任务。' };
  }, [currentUser.id]);

  const markRead = useCallback((id: string) => setState((s) => ({ ...s, notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) })), []);
  const markAllRead = useCallback(
    () => setState((s) => ({ ...s, notifications: s.notifications.map((n) => n.userId === currentUser.id ? { ...n, read: true } : n) })),
    [currentUser.id]
  );

  /* ---------- session & demo ---------- */
  const signOut = useCallback(() => setState((s) => ({ ...s, signedOut: true })), []);
  const signIn = useCallback((userId: string): ActionResult => {
    const user = ref.current.users.find((u) => u.id === userId);
    if (!user) return { ok: false, message: '演示账户不存在。' };
    if (user.status !== 'active') return { ok: false, message: '该账户已停用，无法进入。请联系组织管理员。' };
    setState((s) => ({ ...s, signedOut: false, users: s.users.map((u) => u.id === userId ? { ...u, lastLoginAt: nowIso() } : u) }));
    return { ok: true, message: '已进入演示会话。' };
  }, []);

  const updateDemo = useCallback((patch: Partial<PlatformDemoSettings>) => setState((s) => ({ ...s, demo: { ...s.demo, ...patch } })), []);
  const resetPlatform = useCallback(() => {
    scheduled.current.clear();
    setState(createInitial());
  }, []);

  const preference = state.preferences[currentUser.id] ?? defaultPreference;

  return {
    state,
    account,
    isAdmin,
    preference,
    syncOM,
    checkLatestForStart,
    saveOMSource,
    testGit,
    saveBusiness,
    testBusiness,
    saveMcpPolicy,
    saveGeneral,
    createUser,
    updateUserName,
    changeRole,
    setUserStatus,
    addIdentity,
    verifyIdentity,
    removeIdentity,
    reauthorize,
    testDelegation,
    revokeDelegation,
    expireDelegation,
    renewGrant,
    revokeGrant,
    mcpRead,
    saveProfile,
    savePreference,
    markRead,
    markAllRead,
    signIn,
    signOut,
    updateDemo,
    resetPlatform
  };
}

type PlatformValue = ReturnType<typeof useProvidePlatform>;
const PlatformContext = createContext<PlatformValue | null>(null);

export function PlatformProvider({ children }: {children: React.ReactNode;}) {
  const value = useProvidePlatform();
  const memo = useMemo(() => value, [value]);
  return <PlatformContext.Provider value={memo}>{children}</PlatformContext.Provider>;
}

export function usePlatform(): PlatformValue {
  const ctx = useContext(PlatformContext);
  if (!ctx) throw new Error('usePlatform must be used inside PlatformProvider');
  return ctx;
}

export { grantActive };