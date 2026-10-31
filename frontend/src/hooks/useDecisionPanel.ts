import { useEffect, useMemo, useState } from "react";
import { useWorkbench } from "../contexts/WorkbenchContext";
import type { DecisionRequest, Draft, SubmitOutcome } from "../types/workbench";
import {
  canResolveRequest,
  createEmptyDraft,
  draftHasContent,
  validateDraft,
} from "../utils/decisionService";
import { formatTime, nowIso } from "../utils/time";

export type BriefStatus = "loading" | "ready" | "error";

export function useDecisionPanel(request: DecisionRequest) {
  const {
    state,
    drafts,
    currentUser,
    saveDraft,
    discardDraft,
    markViewed,
    submitUserDecision,
    lookupSubmission,
  } = useWorkbench();
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [briefStatus, setBriefStatus] = useState<BriefStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const briefLoadFail = state.settings.briefLoadFail;

  useEffect(() => {
    setStep("edit");
    setShowErrors(false);
    setOutcome(drafts[request.id]?.pending ? { kind: "unknown" } : null);
    if (drafts[request.id]?.pending) setStep("confirm");
    setPendingKey(null);
    setLookupMessage(null);
  }, [request.id]);

  useEffect(() => {
    setBriefStatus(briefLoadFail ? "error" : "ready");
  }, [request.id, attempt, briefLoadFail]);

  useEffect(() => {
    if (state.viewed[request.id] === undefined) markViewed(request.id);
  }, [request.id, state.viewed, markViewed]);

  const draft = drafts[request.id] ?? null;
  const readRevision = state.viewed[request.id] ?? request.version;
  const emptyDraft = useMemo(
    () => createEmptyDraft({ ...request, version: readRevision }),
    [request.id, readRevision],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const value: Draft = draft ?? emptyDraft;

  useEffect(() => {
    if (
      request.userDecision &&
      draft &&
      request.userDecision.idempotencyKey === draft.idempotencyKey
    ) {
      discardDraft(request.id);
    }
  }, [request.userDecision, draft, discardDraft, request.id]);

  const canResolve = canResolveRequest(request, currentUser);
  const viewedVersion = state.viewed[request.id] ?? request.version;
  const baseVersion = draft ? draft.baseVersion : viewedVersion;
  const isPending = request.status === "pending";

  const contextChanged = isPending && baseVersion < request.version;
  const unseenChanges = request.changes.filter((c) => c.version > baseVersion);
  const errors = validateDraft(value, request);
  const hasErrors = Object.keys(errors).length > 0;
  const conflictDraft =
    request.status === "answered" &&
    Boolean(draft && draftHasContent(draft)) &&
    request.userDecision?.idempotencyKey !== draft?.idempotencyKey;

  const update = (patch: Partial<Draft>) => {
    if (!value.pending) saveDraft({ ...value, ...patch, updatedAt: nowIso() });
  };

  const goConfirm = () => {
    setShowErrors(true);
    if (!hasErrors || value.pending) {
      setStep("confirm");
      setOutcome(null);
      setLookupMessage(null);
    }
  };

  const backToEdit = () => {
    setStep("edit");
    setOutcome(null);
  };

  const reviewLatest = () => {
    if (value.pending) return;
    markViewed(request.id);
    if (draft)
      saveDraft({
        ...draft,
        baseVersion: request.version,
        updatedAt: nowIso(),
      });
    setOutcome(null);
    setStep("edit");
  };

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setOutcome(null);
    setLookupMessage(null);
    const res = await submitUserDecision(request.id, value);
    setSubmitting(false);
    setOutcome(res);
    if (res.kind === "unknown") setPendingKey(value.idempotencyKey);
    if (res.kind === "accepted" || res.kind === "duplicate") {
      discardDraft(request.id);
      setStep("edit");
    }
  };

  const checkAcceptance = async () => {
    if (submitting) return;
    setSubmitting(true);
    const r = await lookupSubmission(
      request.id,
      pendingKey ?? value.idempotencyKey,
    );
    setSubmitting(false);
    if (r.status === "found") {
      setOutcome({ kind: "accepted", userDecision: r.userDecision });
      discardDraft(request.id);
      setStep("edit");
    } else if (r.status === "other") {
      setOutcome({ kind: "conflict", userDecision: r.userDecision });
    } else {
      setLookupMessage(
        `${formatTime(nowIso())} 查询：尚未查到接受记录。请稍后再次查询，不要重复提交。`,
      );
    }
  };

  const discard = () => {
    discardDraft(request.id);
    setShowErrors(false);
    setStep("edit");
    setOutcome(null);
  };

  return {
    step,
    showErrors,
    submitting,
    outcome,
    lookupMessage,
    briefStatus,
    draft,
    value,
    errors,
    canResolve,
    contextChanged,
    draftStale: false,
    frozen: !!value.pending,
    displayedRequest: (() => {
      const c = request.contextHistory?.find(
        (c) => c.revision === value.baseVersion,
      );
      return c
        ? {
            ...request,
            version: c.revision,
            brief: {
              ...request.brief,
              rawContext: c.content,
              sourceReferences: c.sources,
            },
          }
        : request;
    })(),
    unseenChanges,
    conflictDraft,
    update,
    goConfirm,
    backToEdit,
    reviewLatest,
    submit,
    checkAcceptance,
    discard,
    retryBrief: () => setAttempt((a) => a + 1),
  };
}
