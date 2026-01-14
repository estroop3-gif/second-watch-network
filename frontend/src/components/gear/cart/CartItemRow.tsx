/**
 * Cart Item Row Component
 * Displays a single cart item with quantity controls and remove button.
 */
import { useState } from 'react';
import { Minus, Plus, Trash2, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useGearCartContext } from '@/context/GearCartContext';
import type { GearCartItem } from '@/types/gear';
import { cn } from '@/lib/utils';

interface CartItemRowProps {
  item: GearCartItem;
  className?: string;
}

export function CartItemRow({ item, className }: CartItemRowProps) {
  const { updateQuantity, removeFromCart, isUpdating, isRemoving } = useGearCartContext();
  const [localQuantity, setLocalQuantity] = useState(item.quantity);
  const [isUpdatingLocal, setIsUpdatingLocal] = useState(false);

  const asset = item.listing.asset;
  const photos = asset.photos || [];
  const primaryPhoto = photos[0];
  const dailyRate = item.listing.daily_rate || 0;
  const lineTotal = dailyRate * item.quantity;

  const handleQuantityChange = async (newQuantity: number) => {
    if (newQuantity < 1 || newQuantity > 99) return;
    setLocalQuantity(newQuantity);
    setIsUpdatingLocal(true);
    try {
      await updateQuantity(item.id, newQuantity);
    } finally {
      setIsUpdatingLocal(false);
    }
  };

  const handleRemove = async () => {
    try {
      await removeFromCart(item.id);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const isDisabled = isUpdating || isRemoving || isUpdatingLocal;

  return (
    <div className={cn('flex gap-3 py-3', className)}>
      {/* Image */}
      <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden bg-muted">
        {primaryPhoto ? (
          <img
            src={primaryPhoto}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Camera className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-sm truncate">{asset.name}</h4>
        <p className="text-xs text-muted-foreground truncate">
          {[asset.manufacturer, asset.model].filter(Boolean).join(' ') || 'No details'}
        </p>
        {item.project_title && (
          <Badge variant="secondary" className="mt-1 text-xs">
            {item.project_title}
          </Badge>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm font-medium">
            ${dailyRate.toFixed(2)}/day
          </span>
          {item.quantity > 1 && (
            <span className="text-xs text-muted-foreground">
              = ${lineTotal.toFixed(2)}/day
            </span>
          )}
        </div>
      </div>

      {/* Quantity and Remove */}
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleQuantityChange(localQuantity - 1)}
            disabled={isDisabled || localQuantity <= 1}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            type="number"
            min="1"
            max="99"
            value={localQuantity}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              if (!isNaN(val)) handleQuantityChange(val);
            }}
            className="h-7 w-12 text-center text-sm"
            disabled={isDisabled}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => handleQuantityChange(localQuantity + 1)}
            disabled={isDisabled || localQuantity >= 99}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={handleRemove}
          disabled={isDisabled}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Remove
        </Button>
      </div>
    </div>
  );
}
