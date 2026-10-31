export interface PrototypeFile { id?: string; name: string; size: number; content: string }
export type ActionType = 'fact' | 'judgment' | 'authorization' | 'investigation';
export type RequestKind = 'judgment' | 'fact' | 'authorization';
export type UserDecisionChannel = '工作台' | '业务系统';

export interface DemoUser {
  id: string;
  name: string;
  role: string;
  email: string;
  systemRole: 'admin' | 'member';
  status: 'active' | 'disabled';
  lastLoginAt: string | null;
  visibleProjectIds: string[];
  canRequestCancel: boolean;
}

export interface Project {
  id: string;
  name: string;
  sourceSystem: string;
  businessRef: string;
  businessTaskRef: string;
  description: string;
  lastActivity: string;
}

export type EventKind = 'system' | 'receipt' | 'agent' | 'request' | 'human' | 'resume';

export interface ExecEvent {
  id: string;
  at: string;
  kind: EventKind;
  title: string;
  detail?: string;
  requestId?: string;
  evidenceIds?: string[];
}

export type ResultStatus = 'confirmed' | 'draft' | 'unknown';

export interface ResultItem {
  id: string;
  title: string;
  status: ResultStatus;
  detail: string;
  evidenceIds?: string[];
}

export interface LogEntry {
  id: string;
  at: string;
  tool: string;
  call: string;
  receipt: string;
  receiptStatus: 'confirmed' | 'pending' | 'none';
}

export interface CancelOutcome {
  stopped: string[];
  retained: string[];
  businessEffects: string[];
  unverified: string[];
}

export interface Cancellation {
  status: 'requested' | 'delayed' | 'confirmed';
  requestedAt: string;
  requestedBy: string;
  resolvedAt?: string;
  lastCheckedAt?: string;
  reason?: string;
  outcome?: CancelOutcome;
}

export interface WorkSummary {
  doing: string[];
  waiting: string[];
  canContinue: string[];
}

export interface Execution {
  id: string;
  projectId: string;
  ownerId: string;
  sessionId?: string;
  phase?: string;
  historyLimitations?: string[];
  goal: string;
  scope: string;
  source: {system: string;ref: string;label: string;};
  omRepo: string;
  omCommit: string;
  runtimeVersion: string;
  skillVersion: string;
  startedAt: string;
  updatedAt: string;
  lastSyncedAt: string;
  ended: boolean;
  summary: WorkSummary;
  events: ExecEvent[];
  results: ResultItem[];
  logs: LogEntry[];
  uploads?: PrototypeFile[];
  cancellation: Cancellation | null;
}

export interface BriefFact {
  text: string;
  evidenceId?: string;
}

export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  risk: string;
}

export interface Recommendation {
  optionId?: string;
  text: string;
  rationale: string;
  uncertainty: string;
}

export interface AuthorizationScope {
  object: string;
  action: string;
  scope: string;
  note: string;
}

export interface DecisionBriefData {
  rawContext?: unknown;
  sourceReferences?: unknown[];
  actionNeeded: string;
  trigger: string;
  affected: string[];
  continuing: string[];
  recommendation: Recommendation | null;
  noRecommendationReason?: string;
  facts: BriefFact[];
  assumptions: string[];
  gaps: string[];
  options: DecisionOption[];
  evidenceIds: string[];
  decisionModel: {id: string;title: string;path: string;};
  omCommit: string;
  origin: string;
  authorization?: AuthorizationScope;
}

export interface ContextChange {
  version: number;
  at: string;
  source: string;
  summary: string;
  scope: string;
}

export interface PendingContextUpdate {
  source: string;
  summary: string;
  scope: string;
  addFacts: BriefFact[];
  addEvidenceIds: string[];
  removeGaps: string[];
}

export interface UserDecision {
  files?: PrototypeFile[];
  id: string;
  requestId: string;
  action: ActionType;
  choiceId?: string;
  choiceLabel?: string;
  content: string;
  reason?: string;
  source?: string;
  actorId: string;
  actorName: string;
  channel: UserDecisionChannel;
  at: string;
  basisVersion: number;
  idempotencyKey: string;
}

export interface FollowUp {
  status: 'confirming' | 'continued' | 'recorded';
  message: string;
  remaining: string[];
  updatedAt: string;
}

export interface DecisionRequest {
  id: string;
  executionId: string;
  ownerId: string;
  question: string;
  kind: RequestKind;
  waitingItem: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  allowedActions: ActionType[];
  contextHistory?: {revision: number; content: unknown; sources: unknown[]}[];
  brief: DecisionBriefData;
  status: 'pending' | 'answered';
  userDecision: UserDecision | null;
  decisionHistory?: UserDecision[];
  followUp: FollowUp | null;
  changes: ContextChange[];
  contextUpdate: PendingContextUpdate | null;
}

export interface Evidence {
  id: string;
  title: string;
  system: string;
  objectId: string;
  version: string;
  locator: string;
  excerpt: string;
  agentSummary: string;
}

export interface Draft {
  pending?: { text: string; files: string[]; contextRevision: number; optionId?: string; correctionOf?: string };
  correctionOf?: string;
  files?: PrototypeFile[];
  requestId: string;
  action: ActionType | null;
  choiceId: string;
  reason: string;
  fact: string;
  factSource: string;
  investigation: string;
  authorizeConfirm: boolean;
  note: string;
  baseVersion: number;
  updatedAt: string;
  idempotencyKey: string;
}

export type SubmitMode = 'normal' | 'unknown' | 'failed';

export interface DemoSettings {
  submitMode: SubmitMode;
  evidenceUnavailable: boolean;
  cancelDelayed: boolean;
  connectionLostAt: string | null;
  briefLoadFail: boolean;
  sessionExpired: boolean;
}

export interface WorkbenchState {
  userId: string;
  executions: Execution[];
  requests: DecisionRequest[];
  settings: DemoSettings;
  viewed: Record<string, number>;
}

export type SubmitOutcome =
{kind: 'accepted';userDecision: UserDecision;} |
{kind: 'duplicate';userDecision: UserDecision;} |
{kind: 'conflict';userDecision: UserDecision;} |
{kind: 'stale';changes: ContextChange[];} |
{kind: 'forbidden';reason: string;} |
{kind: 'failed';message: string;} |
{kind: 'unknown';};

export type LookupResult =
{status: 'found';userDecision: UserDecision;} |
{status: 'other';userDecision: UserDecision;} |
{status: 'notFound';};

export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text: string;
  kind?: 'answer' | 'redirect' | 'unknown';
  requestId?: string;
  at: string;
}
