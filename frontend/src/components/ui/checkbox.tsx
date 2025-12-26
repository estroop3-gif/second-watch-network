import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckboxProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
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
        role="checkbox"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border-2 border-muted-gray/60 bg-transparent ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-yellow focus-visible:ring-offset-2 cursor-pointer flex items-center justify-center transition-colors",
          checked && "bg-accent-yellow border-accent-yellow",
          disabled && "cursor-not-allowed opacity-50",
          !disabled && "hover:border-muted-gray",
          className,
        )}
      >
        {checked && <Check className="h-3 w-3 stroke-[3] text-charcoal-black" />}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
