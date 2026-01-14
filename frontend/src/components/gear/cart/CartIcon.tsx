/**
 * Cart Icon Component
 * Shows shopping cart icon with badge count.
 * Used in navigation/header to access cart drawer.
 */
import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useGearCartContext } from '@/context/GearCartContext';
import { cn } from '@/lib/utils';

interface CartIconProps {
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  showBadge?: boolean;
}

export function CartIcon({
  className,
  variant = 'ghost',
  showBadge = true,
}: CartIconProps) {
  const { totalItems, toggleCart, isLoading } = useGearCartContext();

  return (
    <Button
      variant={variant}
      size="icon"
      className={cn('relative', className)}
      onClick={toggleCart}
      disabled={isLoading}
    >
      <ShoppingCart className="h-5 w-5" />
      {showBadge && totalItems > 0 && (
        <Badge
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary-red text-white"
          variant="destructive"
        >
          {totalItems > 99 ? '99+' : totalItems}
        </Badge>
      )}
    </Button>
  );
}

// Standalone cart badge for use without button wrapper
export function CartBadge({ className }: { className?: string }) {
  const { totalItems } = useGearCartContext();

  if (totalItems === 0) return null;

  return (
    <Badge
      className={cn(
        'h-5 min-w-5 flex items-center justify-center px-1 text-xs bg-primary-red text-white',
        className
      )}
      variant="destructive"
    >
      {totalItems > 99 ? '99+' : totalItems}
    </Badge>
  );
}
