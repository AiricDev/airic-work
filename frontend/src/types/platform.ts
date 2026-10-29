export type SystemRole = 'admin' | 'member';
export type AccountStatus = 'active' | 'disabled';

/* ---------- OM source (single repository per instance) ---------- */

export interface OMSourceConfig {
  hostType: string;
  repo: string;
  repoUrl: string;
  branch: string;
  credentialRef: string;
}

export type FileChangeStatus = 'added' | 'modified' | 'deleted';

export interface RepoFile {
  path: string;
  content?: string;
  binary?: {size: string;mime: string;};
}

export interface CommitChange {
  path: string;
  status: FileChangeStatus;
  content?: string;
  binary?: {size: string;mime: string;};
}

export interface GitCommit {
  sha: string;
  parents: string[];
  author: string;
  at: string;
  message: string;
  changes: CommitChange[];
}

export type SyncStatus = 'accepted' | 'success' | 'failed';

export interface OMSyncState {
  latestConfirmedSha: string;
  lastSuccessAt: string;
  lastAttempt: {at: string;status: SyncStatus;note: string;} | null;
}

export interface SyncRecord {
  id: string;
  at: string;
  status: '成功' | '失败' | '已接受';
  sha?: string;
  note: string;
}

/* ---------- Decision Context ---------- */

export type DependencyKind = '业务事实' | '文档' | '规则' | '既往决定' | '授权';
export type DependencyStatus = '就绪' | '缺失' | '待核实' | '过期' | '无访问权';

export interface ContextDependency {
  id: string;
  requestId: string;
  name: string;
  kind: DependencyKind;
  source: string;
  version?: string;
  status: DependencyStatus;
  impact: string;
  evidenceId?: string;
  omPath?: string;
  priorRequestId?: string;
  delegationSystem?: string;
  note?: string;
  /** Applied once the request's context has been updated (version > 1). */
  afterUpdate?: {status: DependencyStatus;note: string;evidenceId?: string;version?: string;};
}

/* ---------- Practice ---------- */

export type TrajectoryType = 'action' | 'observation' | 'receipt' | 'intervention' | 'request' | 'system';
export type Confirmation = '权威回执' | 'Agent 描述' | '人工记录' | '未确认';

export interface TrajectoryEvent {
  id: string;
  executionId: string;
  at: string;
  type: TrajectoryType;
  summary: string;
  requestId?: string;
  confirmation: Confirmation;
  input?: string;
  output?: string;
  sensitivity: 'normal' | 'redacted' | 'purged' | 'restricted';
  episodeId?: string;
  evidenceIds?: string[];
}

export interface TrajectoryCoverage {
  executionId: string;
  gapFromMinutesAgo: number;
  gapToMinutesAgo: number;
  gapNote: string;
}

export interface Episode {
  id: string;
  executionId: string;
  requestId: string;
  omSha: string;
  omPath: string;
  title: string;
  question: string;
  context: {name: string;source: string;status: string;}[];
  conclusion: string;
  intervention: string;
  followUp: string;
  limits: string[];
  eventIds: string[];
  evidenceIds: string[];
}

/* ---------- External read-only trajectory MCP ---------- */

export type McpResource = '执行记录索引' | 'Trajectory 分页' | 'Decision Episode' | '版本与 Context 引用';

export interface ExternalClientGrant {
  id: string;
  userId: string;
  clientName: string;
  clientRef: string;
  scope: string;
  resources: McpResource[];
  projectIds: string[];
  status: '有效' | '已撤销' | '已过期';
  grantedAt: string;
  expiresAt: string | null;
}

export interface McpReadLog {
  id: string;
  at: string;
  clientName: string;
  userName: string;
  resource: string;
  result: '已交付' | '已拒绝';
  note: string;
}

/* ---------- Admin & integration ---------- */

export interface TestResult {
  at: string;
  ok: boolean;
  category?: '认证' | '网络' | '能力不可用';
  message: string;
}

export interface BusinessConnection {
  sourceId: string;
  displayName: string;
  jumpTemplate: string;
  mcpEndpoint: string;
  identitySource: string;
  credentialRef: string;
}

export interface TrajectoryMcpPolicy {
  enabled: boolean;
  recordScope: string;
  redaction: string;
  pageSize: number;
}

export interface ApiCaller {
  id: string;
  system: string;
  identityNote: string;
  operations: string[];
  recentAccess: {at: string;operation: string;result: string;}[];
}

export interface RuntimeCapability {
  name: string;
  category: string;
  status: '已验证' | '未验证' | '不可用';
  note: string;
}

export interface SkillVersion {
  name: string;
  version: string;
  role: string;
  validation: string;
}

export interface DataPolicy {
  title: string;
  summary: string;
  source: string;
}

export interface BusinessIdentity {
  id: string;
  userId: string;
  system: string;
  instance: string;
  externalId: string;
  basis: string;
  status: '已验证' | '待验证';
  verifiedAt?: string;
}

export interface Delegation {
  id: string;
  userId: string;
  system: string;
  status: '有效' | '已过期' | '已撤销';
  scope: string;
  expiresAt: string | null;
  lastVerifiedAt: string;
}

export interface ExecutionOrigin {
  executionId: string;
  caller: string;
  initiatorId: string;
  technicalExecutor: string;
  scope: string;
  lastVerifiedAt: string;
}

export type NotificationKind = 'decision' | 'anomaly' | 'result';

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  link: string;
  at: string;
  read: boolean;
}

export interface UserPreference {
  language: 'zh-CN' | 'en-US';
  timezone: string;
  notify: Record<NotificationKind, boolean>;
}

export interface AuditRecord {
  id: string;
  at: string;
  actorName: string;
  action: string;
  target: string;
  result: '成功' | '失败' | '已阻止';
  summary: string;
}

export interface GeneralSettings {
  orgName: string;
  timezone: string;
}

export interface PlatformDemoSettings {
  gitSyncFail: boolean;
  trajectoryMissing: boolean;
  mcpReadDenied: boolean;
  connectionTestFailure: 'none' | 'auth' | 'network' | 'capability';
}

export interface StartCheck {
  at: string;
  ok: boolean;
  sha?: string;
  message: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
}