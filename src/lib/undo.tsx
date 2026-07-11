import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

/**
 * Delete with a safety net: the change applies instantly (soft delete),
 * a snackbar offers Undo for 10 seconds, then the delete becomes real.
 * Anything left half-deleted by a closed app is purged on next boot.
 */

interface PendingAction {
  message: string;
  revert: () => Promise<void> | void;
  commit: () => Promise<void> | void;
}

interface UndoAPI {
  run: (action: PendingAction) => void;
  toast: (message: string) => void;
}

const UndoContext = createContext<UndoAPI>({ run: () => undefined, toast: () => undefined });
export const useUndo = () => useContext(UndoContext);

const UNDO_MS = 10000;

export function UndoProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<PendingAction | null>(null);
  const [plainToast, setPlainToast] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const activeRef = useRef<PendingAction | null>(null);

  const clearTimer = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const settle = useCallback(() => {
    const act = activeRef.current;
    activeRef.current = null;
    clearTimer();
    setCurrent(null);
    if (act) void act.commit();
  }, []);

  const run = useCallback(
    (action: PendingAction) => {
      // a new delete settles any previous one first
      if (activeRef.current) settle();
      activeRef.current = action;
      setCurrent(action);
      setPlainToast(null);
      clearTimer();
      timer.current = window.setTimeout(settle, UNDO_MS);
    },
    [settle]
  );

  const undo = useCallback(() => {
    const act = activeRef.current;
    activeRef.current = null;
    clearTimer();
    setCurrent(null);
    if (act) void act.revert();
  }, []);

  const toast = useCallback(
    (message: string) => {
      // a new message settles any pending undo, so the snackbar never goes stale
      if (activeRef.current) settle();
      setPlainToast(message);
      window.setTimeout(() => setPlainToast((m) => (m === message ? null : m)), 3500);
    },
    [settle]
  );

  return (
    <UndoContext.Provider value={{ run, toast }}>
      {children}
      {current && (
        <div className="snackbar" role="status">
          <span className="msg">{current.message}</span>
          <button className="undo" onClick={undo}>
            Undo
          </button>
          <button className="snack-close" aria-label="Dismiss" onClick={settle}>
            ✕
          </button>
        </div>
      )}
      {!current && plainToast && (
        <div className="snackbar" role="status">
          <span className="msg">{plainToast}</span>
          <button className="snack-close" aria-label="Dismiss" onClick={() => setPlainToast(null)}>
            ✕
          </button>
        </div>
      )}
    </UndoContext.Provider>
  );
}
