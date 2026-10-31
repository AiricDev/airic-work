import type { Draft } from "../types/workbench";
const prefix = "airic-drafts-v1:";
export function readDrafts(userId: string): Record<string, Draft> {
  try {
    const d = JSON.parse(localStorage.getItem(prefix + userId) ?? "{}");
    return d && typeof d === "object" && !Array.isArray(d)
      ? (Object.fromEntries(
          Object.entries(d).filter(
            ([, v]) =>
              v &&
              typeof v === "object" &&
              typeof (v as Draft).requestId === "string" &&
              typeof (v as Draft).idempotencyKey === "string" &&
              [
                "reason",
                "fact",
                "factSource",
                "investigation",
                "note",
                "choiceId",
              ].every(
                (k) => typeof (v as Record<string, unknown>)[k] === "string",
              ) &&
              Number.isInteger((v as Draft).baseVersion),
          ),
        ) as Record<string, Draft>)
      : {};
  } catch {
    return {};
  }
}
export function writeDrafts(userId: string, drafts: Record<string, Draft>) {
  localStorage.setItem(prefix + userId, JSON.stringify(drafts));
}
