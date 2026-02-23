/**
 * useFormDraft — localStorage draft persistence for useState-pattern forms.
 *
 * Replaces a plain `useState` pair with one that auto-saves to localStorage
 * (debounced) and restores on mount. The user still clicks "Save" to commit
 * to the server — this is purely client-side draft persistence.
 *
 * Usage:
 *   const { formData, setFormData, clearDraft } = useFormDraft({
 *     key: buildDraftKey('backlot', 'project-settings', project.id),
 *     initialData: { title: project.title },
 *     serverTimestamp: project.updated_at,
 *   });
 *   // In save handler:  clearDraft();
 */

import { useState, useEffect, useRef, useCallback, Dispatch, SetStateAction } from 'react';
import { toast } from 'sonner';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage } from '@/lib/formDraftStorage';

interface UseFormDraftOptions<T> {
  /** Storage key — use buildDraftKey() to construct */
  key: string;
  /** Default form values (typically derived from server data) */
  initialData: T;
  /** Server `updated_at` — draft is discarded if server is newer */
  serverTimestamp?: string;
  /** Debounce interval in ms (default 500) */
  debounceMs?: number;
  /** Set false while parent data is still loading */
  enabled?: boolean;
  /** Field names to strip before persisting (files, passwords, etc.) */
  skipFields?: (keyof T)[];
}

interface UseFormDraftReturn<T> {
  formData: T;
  setFormData: Dispatch<SetStateAction<T>>;
  /** Whether a draft was restored on this mount */
  isDraftRestored: boolean;
  /** Call after a successful save to remove the draft */
  clearDraft: () => void;
  /** Clear draft and reset to initialData */
  discardDraft: () => void;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function useFormDraft<T extends Record<string, any>>(
  options: UseFormDraftOptions<T>,
): UseFormDraftReturn<T> {
  const {
    key,
    initialData,
    serverTimestamp,
    debounceMs = 500,
    enabled = true,
    skipFields,
  } = options;

  const [formData, setFormData] = useState<T>(initialData);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Refs to avoid stale closures
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialDataRef = useRef(initialData);
  const enabledRef = useRef(enabled);
  const restoredRef = useRef(false);
  const keyRef = useRef(key);

  // Keep refs current
  initialDataRef.current = initialData;
  enabledRef.current = enabled;
  keyRef.current = key;

  // ── Restore on mount (or when enabled flips to true) ──
  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;

    const draft = loadDraft<T>(key);
    if (!draft) return;

    // Conflict check: discard draft if server data is newer
    if (serverTimestamp && draft.serverTs) {
      if (new Date(serverTimestamp).getTime() > new Date(draft.serverTs).getTime()) {
        clearDraftStorage(key);
        return;
      }
    }

    // Don't restore if draft matches initial data
    if (deepEqual(draft.data, initialData)) {
      clearDraftStorage(key);
      return;
    }

    setFormData(draft.data);
    setIsDraftRestored(true);

    const discardAction = () => {
      setFormData(initialDataRef.current);
      clearDraftStorage(key);
      setIsDraftRestored(false);
    };

    toast.info('Draft restored', {
      action: { label: 'Discard', onClick: discardAction },
      duration: 5000,
    });
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync initialData changes (e.g. server refetch) ──
  useEffect(() => {
    if (!restoredRef.current || isDraftRestored) return;
    setFormData(initialData);
  }, [initialData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced persist ──
  useEffect(() => {
    if (!enabledRef.current) return;

    // Auto-clear if data reverted to initial
    if (deepEqual(formData, initialDataRef.current)) {
      clearDraftStorage(keyRef.current);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      let toSave = formData;
      if (skipFields && skipFields.length > 0) {
        toSave = { ...formData };
        for (const f of skipFields) {
          delete (toSave as any)[f];
        }
      }
      saveDraft(keyRef.current, toSave, serverTimestamp);
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [formData, debounceMs, serverTimestamp, skipFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearDraft = useCallback(() => {
    clearDraftStorage(keyRef.current);
    setIsDraftRestored(false);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraftStorage(keyRef.current);
    setFormData(initialDataRef.current);
    setIsDraftRestored(false);
  }, []);

  return { formData, setFormData, isDraftRestored, clearDraft, discardDraft };
}
