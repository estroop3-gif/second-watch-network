/**
 * Scanner Mode Toggle
 * Toggle between USB barcode scanner (keyboard input) and camera scanning modes
 */
import { Camera, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ScannerMode, ScannerModeToggleProps } from '@/types/scanner';
import { cn } from '@/lib/utils';

export function ScannerModeToggle({
  mode,
  onModeChange,
  disabled = false,
  className,
}: ScannerModeToggleProps) {
  return (
    <TooltipProvider>
      <div className={cn('flex items-center gap-1 rounded-lg bg-muted-gray/20 p-1', className)}>
        <ModeButton
          active={mode === 'usb'}
          disabled={disabled}
          onClick={() => onModeChange('usb')}
          icon={<Keyboard className="w-4 h-4" />}
          label="USB Scanner"
          tooltip="Use USB barcode scanner (keyboard input)"
        />
        <ModeButton
          active={mode === 'camera'}
          disabled={disabled}
          onClick={() => onModeChange('camera')}
          icon={<Camera className="w-4 h-4" />}
          label="Camera"
          tooltip="Use device camera to scan barcodes"
        />
      </div>
    </TooltipProvider>
  );
}

interface ModeButtonProps {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
}

function ModeButton({ active, disabled, onClick, icon, label, tooltip }: ModeButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'h-8 px-3 gap-1.5 transition-all',
            active
              ? 'bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30'
              : 'text-muted-gray hover:text-bone-white hover:bg-white/10'
          )}
        >
          {icon}
          <span className="hidden sm:inline text-xs font-medium">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Simple camera button for inline use
interface CameraScanButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function CameraScanButton({ onClick, disabled, className }: CameraScanButtonProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            disabled={disabled}
            onClick={onClick}
            className={cn('h-10 w-10', className)}
          >
            <Camera className="w-4 h-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Scan with camera</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default ScannerModeToggle;
