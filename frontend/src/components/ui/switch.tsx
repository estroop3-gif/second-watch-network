import * as React from "react";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const Switch = React.forwardRef<HTMLDivElement, SwitchProps>(
  ({ checked = false, onCheckedChange, disabled = false, id, className }, ref) => {
    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled && onCheckedChange) {
          onCheckedChange(!checked);
        }
      }
    };

    return (
      <div
        ref={ref}
        id={id}
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-muted-gray/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          checked ? "bg-accent-yellow border-accent-yellow" : "bg-muted-gray/30",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <div
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full shadow-lg ring-0 transition-transform",
            checked ? "translate-x-5 bg-charcoal-black" : "translate-x-0 bg-muted-gray",
          )}
        />
      </div>
    );
  }
);
Switch.displayName = "Switch";

export { Switch };
