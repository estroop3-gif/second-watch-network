/**
 * Set House Cart Context
 * Provides global cart state and actions for the space rental system.
 * This context makes it easy to show cart badge counts and add items from anywhere.
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useSetHouseCart, useSetHouseCartItemCheck } from '@/hooks/set-house/useSetHouseCart';
import type {
  SetHouseCartItem,
  CartItemAddInput,
  CartItemUpdateInput,
} from '@/types/set-house';

// ============================================================================
// TYPES
// ============================================================================

interface SetHouseCartContextType {
  // Cart data
  items: SetHouseCartItem[];
  itemCount: number;
  estimatedTotal: number;
  isLoading: boolean;
  error: Error | null;

  // Cart state
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Cart helpers
  isInCart: (listingId: string) => boolean;
  getCartItem: (listingId: string) => SetHouseCartItem | undefined;

  // Cart actions
  addToCart: (data: CartItemAddInput) => Promise<void>;
  updateQuantity: (itemId: string, updates: CartItemUpdateInput) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  checkout: () => Promise<void>;

  // Loading states
  isAdding: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  isClearing: boolean;
  isCheckingOut: boolean;
  isMutating: boolean;

  // Refresh
  refetch: () => void;
}

const SetHouseCartContext = createContext<SetHouseCartContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function SetHouseCartProvider({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const {
    items,
    itemCount,
    estimatedTotal,
    isLoading,
    error,
    refetch,
    addToCart: addMutation,
    updateCartItem: updateMutation,
    removeFromCart: removeMutation,
    clearCart: clearMutation,
    checkout: checkoutMutation,
  } = useSetHouseCart();

  // Cart open/close
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen(prev => !prev), []);

  // Cart helpers - memoized for performance
  const isInCart = useCallback((listingId: string) => {
    return items.some(item => item.listing_id === listingId);
  }, [items]);

  const getCartItem = useCallback((listingId: string) => {
    return items.find(item => item.listing_id === listingId);
  }, [items]);

  // Wrapped mutations that return promises
  const addToCart = useCallback(async (data: CartItemAddInput) => {
    await addMutation.mutateAsync(data);
  }, [addMutation]);

  const updateQuantity = useCallback(async (itemId: string, updates: CartItemUpdateInput) => {
    await updateMutation.mutateAsync({ itemId, ...updates });
  }, [updateMutation]);

  const removeFromCart = useCallback(async (itemId: string) => {
    await removeMutation.mutateAsync(itemId);
  }, [removeMutation]);

  const clearCart = useCallback(async () => {
    await clearMutation.mutateAsync();
  }, [clearMutation]);

  const checkout = useCallback(async () => {
    await checkoutMutation.mutateAsync();
  }, [checkoutMutation]);

  // Compute isMutating
  const isMutating = useMemo(() => {
    return (
      addMutation.isPending ||
      updateMutation.isPending ||
      removeMutation.isPending ||
      clearMutation.isPending ||
      checkoutMutation.isPending
    );
  }, [
    addMutation.isPending,
    updateMutation.isPending,
    removeMutation.isPending,
    clearMutation.isPending,
    checkoutMutation.isPending,
  ]);

  const value: SetHouseCartContextType = {
    // Cart data
    items,
    itemCount,
    estimatedTotal,
    isLoading,
    error,

    // Cart state
    isCartOpen,
    openCart,
    closeCart,
    toggleCart,

    // Helpers
    isInCart,
    getCartItem,

    // Actions
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    checkout,

    // Loading states
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
    isClearing: clearMutation.isPending,
    isCheckingOut: checkoutMutation.isPending,
    isMutating,

    // Refresh
    refetch,
  };

  return (
    <SetHouseCartContext.Provider value={value}>
      {children}
    </SetHouseCartContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useSetHouseCartContext() {
  const context = useContext(SetHouseCartContext);
  if (context === undefined) {
    throw new Error('useSetHouseCartContext must be used within a SetHouseCartProvider');
  }
  return context;
}

// Optional hook that doesn't throw if outside provider (for conditional usage)
export function useSetHouseCartContextOptional() {
  return useContext(SetHouseCartContext);
}
