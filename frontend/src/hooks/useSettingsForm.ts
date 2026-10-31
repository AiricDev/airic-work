import { useCallback, useEffect, useState } from "react";
import { useBlocker, type BlockerFunction } from "react-router-dom";
import type { ActionResult } from "../types/platform";

export function useSettingsFormState<T>(
  saved: T,
  onSave: (value: T) => ActionResult | Promise<ActionResult>,
) {
  const [value, setValue] = useState<T>(saved);
  const [result, setResult] = useState<ActionResult | null>(null);
  const savedJson = JSON.stringify(saved);

  const [baseline, setBaseline] = useState(savedJson);
  const dirty = JSON.stringify(value) !== baseline;
  useEffect(() => {
    if (!dirty) {
      setValue(JSON.parse(savedJson) as T);
      setBaseline(savedJson);
    }
  }, [savedJson, dirty]);

  const set = (patch: Partial<T>) => {
    setValue((v) => ({ ...v, ...patch }));
    setResult(null);
  };

  const save = async (): Promise<ActionResult> => {
    let r: ActionResult;
    try {
      r = await onSave(value);
    } catch (e) {
      r = { ok: false, message: e instanceof Error ? e.message : "保存失败" };
    }
    setResult(r);
    if (r.ok) setBaseline(JSON.stringify(value));
    return r;
  };

  const revert = () => {
    setValue(JSON.parse(savedJson) as T);
    setBaseline(savedJson);
    setResult(null);
  };

  return { value, set, dirty, save, revert, result };
}
/** One router blocker per settings page; Profile combines its two independent forms. */
export function useSettingsForm<T>(
  saved: T,
  onSave: (value: T) => ActionResult | Promise<ActionResult>,
) {
  const form = useSettingsFormState(saved, onSave);
  const blocker = useBlocker(
    useCallback<BlockerFunction>(
      ({ currentLocation, nextLocation }) =>
        form.dirty && currentLocation.pathname !== nextLocation.pathname,
      [form.dirty],
    ),
  );
  return { ...form, blocker };
}
