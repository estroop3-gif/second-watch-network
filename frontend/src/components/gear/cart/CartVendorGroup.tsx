/**
 * Cart Vendor Group Component
 * Groups cart items by gear house/vendor with expandable sections.
 */
import { useState } from 'react';
import { ChevronDown, ChevronRight, Building2, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { CartItemRow } from './CartItemRow';
import type { GearCartGrouped } from '@/types/gear';
import { cn } from '@/lib/utils';

interface CartVendorGroupProps {
  group: GearCartGrouped;
  isExpanded?: boolean;
  onToggle?: () => void;
  className?: string;
}

export function CartVendorGroup({
  group,
  isExpanded = true,
  onToggle,
  className,
}: CartVendorGroupProps) {
  const [open, setOpen] = useState(isExpanded);
  const org = group.organization;
  const itemCount = group.items.length;
  const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleToggle = () => {
    setOpen(!open);
    onToggle?.();
  };

  // Get initials for fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn('border rounded-lg', className)}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full flex items-center justify-between p-4 h-auto hover:bg-muted/50"
          onClick={handleToggle}
        >
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={org.marketplace_logo_url} alt={org.marketplace_name || org.name} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(org.marketplace_name || org.name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="font-medium">{org.marketplace_name || org.name}</span>
                {org.is_verified && (
                  <BadgeCheck className="h-4 w-4 text-blue-500" />
                )}
              </div>
              {org.location_display && (
                <span className="text-xs text-muted-foreground">{org.location_display}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <Badge variant="secondary" className="text-xs">
                {totalQuantity} item{totalQuantity !== 1 ? 's' : ''}
              </Badge>
              <div className="text-sm font-medium mt-1">
                ${group.total_daily_rate.toFixed(2)}/day
              </div>
            </div>
            {open ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 divide-y">
          {group.items.map(item => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Compact version for smaller spaces
export function CartVendorGroupCompact({
  group,
  className,
}: {
  group: GearCartGrouped;
  className?: string;
}) {
  const org = group.organization;
  const totalQuantity = group.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className={cn('flex items-center justify-between p-3 bg-muted/50 rounded-md', className)}>
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-sm">{org.marketplace_name || org.name}</span>
        {org.is_verified && <BadgeCheck className="h-3 w-3 text-blue-500" />}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {totalQuantity}
        </Badge>
        <span className="text-sm font-medium">${group.total_daily_rate.toFixed(2)}/day</span>
      </div>
    </div>
  );
}
