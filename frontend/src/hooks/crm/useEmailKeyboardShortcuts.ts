import { useEffect, useCallback, useRef } from 'react';

interface EmailKeyboardShortcutsOptions {
  onCompose?: () => void;
  onReply?: () => void;
  onReplyAll?: () => void;
  onArchive?: () => void;
  onStar?: () => void;
  onToggleRead?: () => void;
  onNextThread?: () => void;
  onPrevThread?: () => void;
  onOpenThread?: () => void;
  onCloseThread?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  enabled?: boolean;
}

export function useEmailKeyboardShortcuts(options: EmailKeyboardShortcutsOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!optionsRef.current.enabled) return;

    // Skip when typing in input/textarea/contentEditable
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('[role="textbox"]')
    ) {
      // Only allow Escape in inputs
      if (e.key === 'Escape') {
        optionsRef.current.onCloseThread?.();
        return;
      }
      return;
    }

    // Skip with Ctrl/Meta (let browser shortcuts work)
    if (e.ctrlKey || e.metaKey) return;

    switch (e.key) {
      case 'c':
        e.preventDefault();
        optionsRef.current.onCompose?.();
        break;
      case 'r':
        if (e.shiftKey) {
          e.preventDefault();
          optionsRef.current.onReplyAll?.();
        } else {
          e.preventDefault();
          optionsRef.current.onReply?.();
        }
        break;
      case 'a':
        e.preventDefault();
        optionsRef.current.onArchive?.();
        break;
      case 's':
        e.preventDefault();
        optionsRef.current.onStar?.();
        break;
      case 'e':
        e.preventDefault();
        optionsRef.current.onToggleRead?.();
        break;
      case 'j':
        e.preventDefault();
        optionsRef.current.onNextThread?.();
        break;
      case 'k':
        e.preventDefault();
        optionsRef.current.onPrevThread?.();
        break;
      case 'Enter':
        e.preventDefault();
        optionsRef.current.onOpenThread?.();
        break;
      case 'Escape':
        e.preventDefault();
        optionsRef.current.onCloseThread?.();
        break;
      case '/':
        e.preventDefault();
        optionsRef.current.onFocusSearch?.();
        break;
      case '?':
        e.preventDefault();
        optionsRef.current.onShowHelp?.();
        break;
    }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const KEYBOARD_SHORTCUTS = [
  { key: 'C', description: 'Compose new email' },
  { key: 'R', description: 'Reply to thread' },
  { key: 'Shift+R', description: 'Reply all' },
  { key: 'A', description: 'Archive thread' },
  { key: 'S', description: 'Star/unstar thread' },
  { key: 'E', description: 'Toggle read/unread' },
  { key: 'J', description: 'Next thread' },
  { key: 'K', description: 'Previous thread' },
  { key: 'Enter', description: 'Open selected thread' },
  { key: 'Esc', description: 'Close thread / Go back' },
  { key: '/', description: 'Focus search' },
  { key: '?', description: 'Show keyboard shortcuts' },
];
