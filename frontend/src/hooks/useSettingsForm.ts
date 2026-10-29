import { useCallback, useEffect, useState } from 'react';
import { useBlocker, type BlockerFunction } from 'react-router-dom';
import type { ActionResult } from '../types/platform';

export function useSettingsForm<T>(saved: T, onSave: (value: T) => ActionResult) {
  const [value, setValue] = useState<T>(saved);
  const [result, setResult] = useState<ActionResult | null>(null);
  const savedJson = JSON.stringify(saved);
  const dirty = JSON.stringify(value) !== savedJson;

  useEffect(() => {
    setValue(JSON.parse(savedJson) as T);
  }, [savedJson]);

  const blocker = useBlocker(
    useCallback<BlockerFunction>(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname, [dirty])
  );

  const set = (patch: Partial<T>) => {
    setValue((v) => ({ ...v, ...patch }));
    setResult(null);
  };

  const save = (): ActionResult => {
    const r = onSave(value);
    setResult(r);
    return r;
  };

  const revert = () => {
    setValue(JSON.parse(savedJson) as T);
    setResult(null);
  };

  return { value, set, dirty, save, revert, result, blocker };
}