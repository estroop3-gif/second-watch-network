/**
 * useFormDraftRHF — localStorage draft persistence for React Hook Form.
 *
 * Watches all form fields via `form.watch()` and persists changes to
 * localStorage (debounced). On mount, restores draft via `form.reset()`.
 *
 * Usage:
 *   const form = useForm<MyValues>({ ... });
 *   const { clearDraft } = useFormDraftRHF(form, {
 *     key: buildDraftKey('crm', 'contact', contactId ?? 'new'),
 *   });
 *   // In submit handler:  clearDraft();
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FieldValues, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage } from '@/lib/formDraftStorage';

interface UseFormDraftRHFOptions {
  /** Storage key — use buildDraftKey() to construct */
  key: string;
  /** Server `updated_at` — draft is discarded if server is newer */
  serverTimestamp?: string;
  /** Debounce interval in ms (default 500) */
  debounceMs?: number;
  /** Set false while parent data is still loading */
  enabled?: boolean;
  /** Field names to strip before persisting (files, passwords, etc.) */
  skipFields?: string[];
}

interface UseFormDraftRHFReturn {
  /** Whether a draft was restored on this mount */
  isDraftRestored: boolean;
  /** Call after a successful save to remove the draft */
  clearDraft: () => void;
  /** Clear draft and reset form to its defaultValues */
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

export function useFormDraftRHF<T extends FieldValues>(
  form: UseFormReturn<T>,
  options: UseFormDraftRHFOptions,
): UseFormDraftRHFReturn {
  const {
    key,
    serverTimestamp,
    debounceMs = 500,
    enabled = true,
    skipFields,
  } = options;

  const [isDraftRestored, setIsDraftRestored] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restoredRef = useRef(false);
  const keyRef = useRef(key);
  const defaultsRef = useRef<T | undefined>(undefined);

  keyRef.current = key;

  // ── Restore on mount ──
  useEffect(() => {
    if (!enabled || restoredRef.current) return;
    restoredRef.current = true;

    // Capture defaults at restore time
    defaultsRef.current = form.getValues();

    const draft = loadDraft<Partial<T>>(key);
    if (!draft) return;

    // Conflict: discard if server data is newer
    if (serverTimestamp && draft.serverTs) {
      if (new Date(serverTimestamp).getTime() > new Date(draft.serverTs).getTime()) {
        clearDraftStorage(key);
        return;
      }
    }

    // Don't restore if draft matches current values
    const currentValues = form.getValues();
    if (deepEqual(draft.data, currentValues)) {
      clearDraftStorage(key);
      return;
    }

    // Merge draft over current values
    form.reset({ ...currentValues, ...draft.data } as T);
    setIsDraftRestored(true);

    const discardAction = () => {
      if (defaultsRef.current) {
        form.reset(defaultsRef.current);
      }
      clearDraftStorage(key);
      setIsDraftRestored(false);
    };

    toast.info('Draft restored', {
      action: { label: 'Discard', onClick: discardAction },
      duration: 5000,
    });
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Watch & persist ──
  useEffect(() => {
    if (!enabled) return;

    const subscription = form.watch((values) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        // Auto-clear if reverted to defaults
        if (defaultsRef.current && deepEqual(values, defaultsRef.current)) {
          clearDraftStorage(keyRef.current);
          return;
        }

        let toSave = { ...values };
        if (skipFields && skipFields.length > 0) {
          for (const f of skipFields) {
            delete toSave[f];
          }
        }
        saveDraft(keyRef.current, toSave, serverTimestamp);
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, debounceMs, serverTimestamp, skipFields]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearDraft = useCallback(() => {
    clearDraftStorage(keyRef.current);
    setIsDraftRestored(false);
  }, []);

  const discardDraft = useCallback(() => {
    clearDraftStorage(keyRef.current);
    if (defaultsRef.current) {
      form.reset(defaultsRef.current);
    }
    setIsDraftRestored(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isDraftRestored, clearDraft, discardDraft };
}
