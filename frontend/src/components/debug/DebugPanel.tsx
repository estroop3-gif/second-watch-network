/**
 * DebugPanel — floating error/warning capture panel.
 * Intercepts console.error and console.warn and displays them in a
 * collapsible overlay. Toggle with the bug button (bottom-right).
 * Only rendered in DEV mode.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Bug, X, Trash2, ChevronDown, ChevronUp, AlertCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: number;
  type: 'error' | 'warn';
  message: string;
  timestamp: string;
}

let _idCounter = 0;

export function DebugPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const originalErrorRef = useRef<typeof console.error>(console.error);
  const originalWarnRef = useRef<typeof console.warn>(console.warn);

  const addEntry = useCallback((type: 'error' | 'warn', args: unknown[]) => {
    const message = args
      .map((a) => {
        if (typeof a === 'string') return a;
        try { return JSON.stringify(a, null, 2); } catch { return String(a); }
      })
      .join(' ');

    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

    setEntries((prev) => [
      { id: ++_idCounter, type, message, timestamp },
      ...prev.slice(0, 99), // keep last 100
    ]);
  }, []);

  useEffect(() => {
    const origError = console.error.bind(console);
    const origWarn = console.warn.bind(console);
    originalErrorRef.current = origError;
    originalWarnRef.current = origWarn;

    console.error = (...args: unknown[]) => {
      origError(...args);
      addEntry('error', args);
    };

    console.warn = (...args: unknown[]) => {
      origWarn(...args);
      addEntry('warn', args);
    };

    return () => {
      console.error = origError;
      console.warn = origWarn;
    };
  }, [addEntry]);

  const errorCount = entries.filter((e) => e.type === 'error').length;
  const warnCount  = entries.filter((e) => e.type === 'warn').length;

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setMinimized(false); }}
          title="Open debug panel"
          className={cn(
            'fixed bottom-4 right-4 z-[9998] flex items-center gap-1.5 rounded-full px-3 py-2',
            'bg-charcoal-black border text-xs font-mono shadow-lg',
            errorCount > 0
              ? 'border-red-500 text-red-400'
              : warnCount > 0
              ? 'border-yellow-500 text-yellow-400'
              : 'border-muted-gray/40 text-muted-gray hover:border-muted-gray/70',
          )}
        >
          <Bug className="h-3.5 w-3.5" />
          {errorCount > 0 && <span className="text-red-400">{errorCount}E</span>}
          {warnCount > 0  && <span className="text-yellow-400">{warnCount}W</span>}
          {errorCount === 0 && warnCount === 0 && <span>debug</span>}
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          className={cn(
            'fixed bottom-4 right-4 z-[9999] w-[480px] max-w-[calc(100vw-2rem)]',
            'rounded-lg border border-muted-gray/30 bg-[#0d0d0d] shadow-2xl',
            'flex flex-col font-mono text-xs',
            minimized ? 'h-auto' : 'max-h-[420px]',
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-muted-gray/20 shrink-0">
            <Bug className="h-3.5 w-3.5 text-muted-gray" />
            <span className="text-bone-white font-medium flex-1">Debug Console</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-red-900/50 text-red-400">{errorCount} error{errorCount !== 1 ? 's' : ''}</span>
            )}
            {warnCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-yellow-900/50 text-yellow-400">{warnCount} warning{warnCount !== 1 ? 's' : ''}</span>
            )}
            <button
              onClick={() => setEntries([])}
              title="Clear"
              className="p-1 rounded hover:bg-muted-gray/20 text-muted-gray hover:text-bone-white"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setMinimized((m) => !m)}
              title={minimized ? 'Expand' : 'Minimize'}
              className="p-1 rounded hover:bg-muted-gray/20 text-muted-gray hover:text-bone-white"
            >
              {minimized ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => setOpen(false)}
              title="Close"
              className="p-1 rounded hover:bg-muted-gray/20 text-muted-gray hover:text-bone-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Log entries */}
          {!minimized && (
            <div className="overflow-y-auto flex-1 divide-y divide-muted-gray/10">
              {entries.length === 0 ? (
                <p className="p-4 text-muted-gray text-center">No errors or warnings captured.</p>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'flex gap-2 px-3 py-2',
                      entry.type === 'error' ? 'bg-red-950/20' : 'bg-yellow-950/20',
                    )}
                  >
                    {entry.type === 'error'
                      ? <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                      : <AlertTriangle className="h-3.5 w-3.5 text-yellow-400 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'break-words whitespace-pre-wrap leading-relaxed',
                        entry.type === 'error' ? 'text-red-300' : 'text-yellow-300',
                      )}>
                        {entry.message}
                      </p>
                    </div>
                    <span className="text-muted-gray shrink-0 ml-1">{entry.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default DebugPanel;
