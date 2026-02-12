/**
 * Cart Drawer Component
 * Slide-out panel showing cart contents grouped by vendor.
 * Allows viewing items, adjusting quantities, and submitting requests.
 */
import { useState } from 'react';
import { ShoppingCart, Trash2, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useGearCartContext } from '@/context/GearCartContext';
import { CartVendorGroup } from './CartVendorGroup';
import { CartSubmitForm } from './CartSubmitForm';
import { cn } from '@/lib/utils';

interface CartDrawerProps {
  backlotProjectId?: string;
}

type DrawerView = 'cart' | 'checkout';

export function CartDrawer({ backlotProjectId }: CartDrawerProps) {
  const {
    isCartOpen,
    closeCart,
    groups,
    totalItems,
    totalDailyRate,
    isLoading,
    clearCart,
    isClearing,
  } = useGearCartContext();

  const [view, setView] = useState<DrawerView>('cart');

  const handleClose = () => {
    closeCart();
    // Reset view after close animation
    setTimeout(() => setView('cart'), 300);
  };

  const handleClear = async () => {
    try {
      await clearCart();
    } catch (error) {
      console.error('Failed to clear cart:', error);
    }
  };

  const handleCheckoutSuccess = () => {
    setView('cart');
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            {view === 'checkout' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('cart')}
                className="gap-1 -ml-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <SheetTitle>Cart ({totalItems})</SheetTitle>
              </div>
            )}
          </div>
        </SheetHeader>

        {/* Content */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <EmptyCart onClose={handleClose} />
          ) : view === 'cart' ? (
            <div className="p-4 space-y-4">
              {groups.map(group => (
                <CartVendorGroup key={group.organization.id} group={group} />
              ))}
            </div>
          ) : (
            <div className="p-4">
              <CartSubmitForm
                backlotProjectId={backlotProjectId}
                onSuccess={handleCheckoutSuccess}
                onCancel={() => setView('cart')}
              />
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {groups.length > 0 && view === 'cart' && (
          <SheetFooter className="px-6 py-4 border-t">
            <div className="w-full space-y-4">
              {/* Summary */}
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {groups.length} vendor{groups.length !== 1 ? 's' : ''}, {totalItems} item{totalItems !== 1 ? 's' : ''}
                  </p>
                  <p className="text-lg font-semibold">
                    ${totalDailyRate.toFixed(2)}/day
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear Cart?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove all {totalItems} item{totalItems !== 1 ? 's' : ''} from your cart.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClear}
                        className="bg-destructive hover:bg-destructive/90"
                        disabled={isClearing}
                      >
                        {isClearing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-1" />
                        )}
                        Clear Cart
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Actions */}
              <Button className="w-full" size="lg" onClick={() => setView('checkout')}>
                <Send className="h-4 w-4 mr-2" />
                Request Rentals
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Empty cart state
function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
      <h3 className="font-medium text-lg mb-2">Your cart is empty</h3>
      <p className="text-muted-foreground text-sm mb-6">
        Browse the marketplace to add rental items to your cart.
      </p>
      <Button onClick={onClose}>
        Continue Browsing
      </Button>
    </div>
  );
}
