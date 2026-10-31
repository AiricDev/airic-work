/** Transport → existing UI view models. Missing product data stays empty/unknown; no seed fallbacks. */
import type {
  DecisionRequest,
  DemoUser,
  Execution,
  Project,
  UserDecision,
} from "../types/workbench";
import type { Result } from "./client";
export function userView(u: Result<"me">, projectIds: string[] = []): DemoUser {
  return {
    id: u.id,
    name: u.name,
    role: u.admin ? "管理员" : "成员",
    email: "",
    systemRole: u.admin ? "admin" : "member",
    status: u.enabled ? "active" : "disabled",
    lastLoginAt: null,
    visibleProjectIds: projectIds,
    canRequestCancel: true,
  };
}
export function projectView(p: Result<"projects">["items"][number]): Project {
  return {
    id: p.id,
    name: p.name,
    sourceSystem: p.source,
    businessRef: p.externalId,
    businessTaskRef: p.externalId,
    description: "",
    lastActivity: "",
  };
}
export function executionView(e: Result<"execution">): Execution {
  return {
    id: e.id,
    sessionId: e.sessionId,
    projectId: e.projectId,
    ownerId: e.ownerId,
    goal: e.creation.instruction,
    scope: JSON.stringify(e.creation.task),
    source: {
      system: e.creation.source,
      ref: e.creation.project_id,
      label: e.creation.project_name,
    },
    omRepo: e.method?.source ?? "",
    omCommit: e.method?.sha ?? "",
    runtimeVersion: e.method?.runtimeVersion ?? "",
    skillVersion: e.method?.skillVersion ?? "",
    phase: e.phase,
    startedAt: "",
    updatedAt: "",
    lastSyncedAt: "",
    ended: ["ended", "failed", "stopped"].includes(e.phase),
    summary: { doing: [], waiting: [], canContinue: [] },
    events: [],
    results: [],
    logs: [],
    cancellation:
      e.phase === "stopping" || e.phase === "stopped"
        ? {
            status: e.phase === "stopped" ? "confirmed" : "requested",
            requestedAt: "",
            requestedBy: e.ownerId,
          }
        : null,
  };
}
export function decisionView(
  d: Result<"answer">,
  r: Result<"request">,
  name: string,
  key = "",
): UserDecision {
  return {
    id: d.id,
    requestId: d.requestId,
    action: d.optionId ? "judgment" : "fact",
    choiceId: d.optionId,
    choiceLabel: r.options.find((o) => o.id === d.optionId)?.label,
    content: d.text,
    actorId: d.userId,
    actorName: name,
    channel: "工作台",
    at: d.at,
    basisVersion: d.contextRevision,
    idempotencyKey: key,
    files: d.files.map((id) => ({
      id,
      name: id,
      size: 0,
      content: `/api/v1/input-files/${encodeURIComponent(id)}/content`,
    })),
  };
}
export function requestView(
  r: Result<"request">,
  e: Execution,
  name: string,
  decisions: Result<"decisions"> = [],
  inputs: Result<"inputs"> = [],
): DecisionRequest {
  const context = r.contexts.at(-1)!;
  const history = decisions.map((d) => decisionView(d, r, name));
  const last = history.at(-1) ?? null;
  const delivery = last
    ? inputs.find((i) => i.kind === "user-decision" && i.sourceId === last.id)
    : undefined;
  return {
    id: r.id,
    executionId: r.executionId,
    ownerId: e.ownerId,
    question: r.question,
    kind: r.options.length ? "judgment" : "fact",
    waitingItem: r.question,
    createdAt: r.createdAt,
    updatedAt: r.answeredAt ?? r.createdAt,
    version: context?.revision ?? 1,
    allowedActions: r.options.length
      ? ["judgment", "fact", "investigation"]
      : ["fact", "investigation"],
    contextHistory: r.contexts,
    status: r.status,
    userDecision: last,
    decisionHistory: history.slice(0, -1),
    contextUpdate: null,
    changes: r.contexts.map((c) => ({
      version: c.revision,
      at: "",
      source: "Decision Context",
      summary: `修订 ${c.revision}`,
      scope: r.question,
    })),
    followUp:
      r.status === "answered"
        ? {
            status: "recorded",
            message:
              delivery?.status === "delivered"
                ? "消息已被 Runtime 持久接收；Agent 继续与业务完成仍需另行确认。"
                : "回答已保存，消息尚待交付。",
            remaining: [],
            updatedAt: r.answeredAt ?? "",
          }
        : null,
    brief: {
      rawContext: context?.content,
      sourceReferences: context?.sources,
      actionNeeded: r.question,
      trigger: "Agent 发起了需要用户回应的 DecisionRequest。",
      affected: [],
      continuing: [],
      recommendation: null,
      noRecommendationReason: "未提供结构化建议；请阅读原始 Decision Context。",
      facts: [],
      assumptions: [],
      gaps: [],
      options: r.options.map((o) => ({ ...o, risk: "" })),
      evidenceIds: [],
      decisionModel: { id: "", title: "执行固定 OM", path: "" },
      omCommit: e.omCommit,
      origin: e.source.system,
    },
  };
}
