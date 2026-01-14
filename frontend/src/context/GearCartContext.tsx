/**
 * Gear Cart Context
 * Provides global cart state and actions for the gear rental system.
 * This context makes it easy to show cart badge counts and add items from anywhere.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useGearCartWithMutations } from '@/hooks/gear/useGearCart';
import type {
  GearCartGrouped,
  GearCartItem,
  CartItemAddInput,
  CartSubmitInput,
} from '@/types/gear';

// ============================================================================
// TYPES
// ============================================================================

interface GearCartContextType {
  // Cart data
  groups: GearCartGrouped[];
  totalItems: number;
  totalDailyRate: number;
  isLoading: boolean;
  error: Error | null;

  // Cart state
  isCartOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;

  // Cart helpers
  isInCart: (listingId: string) => boolean;
  getCartItem: (listingId: string) => GearCartItem | undefined;

  // Cart actions
  addToCart: (data: CartItemAddInput) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  submitCart: (data: CartSubmitInput) => Promise<{ requests: Array<{ id: string; reference_number: string }> }>;

  // Loading states
  isAdding: boolean;
  isUpdating: boolean;
  isRemoving: boolean;
  isClearing: boolean;
  isSubmitting: boolean;
  isMutating: boolean;

  // Refresh
  refetch: () => void;
}

const GearCartContext = createContext<GearCartContextType | undefined>(undefined);

// ============================================================================
// PROVIDER
// ============================================================================

export function GearCartProvider({ children }: { children: React.ReactNode }) {
  const [isCartOpen, setIsCartOpen] = useState(false);

  const {
    groups,
    totalItems,
    totalDailyRate,
    isLoading,
    error,
    isInCart,
    getCartItem,
    refetch,
    addToCart: addMutation,
    updateCartItem: updateMutation,
    removeFromCart: removeMutation,
    clearCart: clearMutation,
    submitCart: submitMutation,
    isMutating,
  } = useGearCartWithMutations();

  // Cart open/close
  const openCart = useCallback(() => setIsCartOpen(true), []);
  const closeCart = useCallback(() => setIsCartOpen(false), []);
  const toggleCart = useCallback(() => setIsCartOpen(prev => !prev), []);

  // Wrapped mutations that return promises
  const addToCart = useCallback(async (data: CartItemAddInput) => {
    await addMutation.mutateAsync(data);
  }, [addMutation]);

  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    await updateMutation.mutateAsync({ itemId, data: { quantity } });
  }, [updateMutation]);

  const removeFromCart = useCallback(async (itemId: string) => {
    await removeMutation.mutateAsync(itemId);
  }, [removeMutation]);

  const clearCart = useCallback(async () => {
    await clearMutation.mutateAsync();
  }, [clearMutation]);

  const submitCart = useCallback(async (data: CartSubmitInput) => {
    return await submitMutation.mutateAsync(data);
  }, [submitMutation]);

  const value: GearCartContextType = {
    // Cart data
    groups,
    totalItems,
    totalDailyRate,
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
    submitCart,

    // Loading states
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
    isClearing: clearMutation.isPending,
    isSubmitting: submitMutation.isPending,
    isMutating,

    // Refresh
    refetch,
  };

  return (
    <GearCartContext.Provider value={value}>
      {children}
    </GearCartContext.Provider>
  );
}

// ============================================================================
// HOOK
// ============================================================================

export function useGearCartContext() {
  const context = useContext(GearCartContext);
  if (context === undefined) {
    throw new Error('useGearCartContext must be used within a GearCartProvider');
  }
  return context;
}

// Optional hook that doesn't throw if outside provider (for conditional usage)
export function useGearCartContextOptional() {
  return useContext(GearCartContext);
}
