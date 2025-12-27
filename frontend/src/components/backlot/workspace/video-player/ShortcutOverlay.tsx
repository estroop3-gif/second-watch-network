/**
 * ShortcutOverlay - Modal showing keyboard shortcuts (renders as portal)
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X, Keyboard } from 'lucide-react';
import { SHORTCUTS } from './hooks/useKeyboardShortcuts';

interface ShortcutOverlayProps {
  visible: boolean;
  onClose: () => void;
}

const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({
  visible,
  onClose,
}) => {
  if (!visible) return null;

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200]"
      onClick={onClose}
    >
      <div
        className="rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl border border-white/10"
        style={{ backgroundColor: '#1a1a1a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-accent-yellow" />
            <h3 className="text-lg font-semibold text-bone-white">
              Keyboard Shortcuts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-muted-gray hover:text-bone-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {SHORTCUTS.map((shortcut, index) => (
            <div key={index} className="flex items-center justify-between py-1.5 border-b border-white/5">
              <kbd className="px-2 py-1 bg-charcoal-black rounded text-xs font-mono text-accent-yellow min-w-[80px]">
                {shortcut.key}
              </kbd>
              <span className="text-sm text-muted-gray ml-3 text-right flex-1">
                {shortcut.action}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-white/10 text-center">
          <span className="text-xs text-muted-gray">
            Press <kbd className="px-1.5 py-0.5 bg-charcoal-black rounded text-accent-yellow">?</kbd> or <kbd className="px-1.5 py-0.5 bg-charcoal-black rounded text-accent-yellow">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );

  // Render as portal to document body
  return createPortal(modalContent, document.body);
};

export default ShortcutOverlay;
