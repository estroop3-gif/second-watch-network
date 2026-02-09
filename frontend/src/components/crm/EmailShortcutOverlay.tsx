import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { KEYBOARD_SHORTCUTS } from '@/hooks/crm/useEmailKeyboardShortcuts';

interface EmailShortcutOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmailShortcutOverlay = ({ open, onOpenChange }: EmailShortcutOverlayProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-accent-yellow" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3">
          {KEYBOARD_SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center gap-3 py-1">
              <kbd className="inline-flex items-center justify-center min-w-[28px] h-6 px-1.5 rounded bg-muted-gray/20 border border-muted-gray/30 text-xs font-mono text-bone-white shrink-0">
                {shortcut.key}
              </kbd>
              <span className="text-sm text-muted-gray">{shortcut.description}</span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailShortcutOverlay;
