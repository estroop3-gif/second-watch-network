/**
 * Gear Cart Hooks
 * Data fetching and mutations for persistent shopping cart
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  GearCartResponse,
  GearCartGrouped,
  GearCartItem,
  CartItemAddInput,
  CartItemUpdateInput,
  CartSubmitInput,
  CartSubmitResponse,
  CartCheckResponse,
} from '@/types/gear';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Cart API] ${options?.method || 'GET'} ${fullUrl}`);

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      if (errorText) errorDetail += ` - ${errorText}`;
    }
    console.error(`[Cart API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[Cart API] Response:`, data);
  return data;
}

// ============================================================================
// CART QUERY HOOKS
// ============================================================================

/**
 * Fetch the user's gear cart with items grouped by gear house.
 */
export function useGearCart() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['gear-cart'],
    queryFn: () => fetchWithAuth('/api/v1/gear/cart', token!),
    enabled: !!token,
    select: (data) => data as GearCartResponse,
  });

  // Calculate totals from grouped data
  const groups: GearCartGrouped[] = query.data?.groups ?? [];
  const totalItems = query.data?.total_items ?? 0;
  const totalDailyRate = groups.reduce((sum, g) => sum + g.total_daily_rate, 0);

  // Helper to check if a listing is in the cart
  const isInCart = (listingId: string): boolean => {
    return groups.some(g => g.items.some(item => item.listing_id === listingId));
  };

  // Helper to get cart item by listing ID
  const getCartItem = (listingId: string): GearCartItem | undefined => {
    for (const group of groups) {
      const item = group.items.find(i => i.listing_id === listingId);
      if (item) return item;
    }
    return undefined;
  };

  // Invalidate cart queries
  const invalidateCart = () => {
    queryClient.invalidateQueries({ queryKey: ['gear-cart'] });
  };

  return {
    groups,
    totalItems,
    totalDailyRate,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isInCart,
    getCartItem,
    invalidateCart,
  };
}

/**
 * Check if a specific listing is in the cart (lightweight check).
 */
export function useCartCheck(listingId: string) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['gear-cart-check', listingId],
    queryFn: () => fetchWithAuth(`/api/v1/gear/cart/check/${listingId}`, token!),
    enabled: !!token && !!listingId,
    select: (data) => data as CartCheckResponse,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    inCart: query.data?.in_cart ?? false,
    cartItemId: query.data?.cart_item_id,
    quantity: query.data?.quantity ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  };
}

// ============================================================================
// CART MUTATION HOOKS
// ============================================================================

/**
 * Add an item to the cart.
 */
export function useAddToCart() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CartItemAddInput) => {
      return fetchWithAuth('/api/v1/gear/cart/items', token!, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate cart and any cart checks
      queryClient.invalidateQueries({ queryKey: ['gear-cart'] });
      queryClient.invalidateQueries({ queryKey: ['gear-cart-check'] });
    },
  });
}

/**
 * Update cart item quantity.
 */
export function useUpdateCartItem() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: CartItemUpdateInput }) => {
      return fetchWithAuth(`/api/v1/gear/cart/items/${itemId}`, token!, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-cart'] });
    },
  });
}

/**
 * Remove an item from the cart.
 */
export function useRemoveFromCart() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      return fetchWithAuth(`/api/v1/gear/cart/items/${itemId}`, token!, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-cart'] });
      queryClient.invalidateQueries({ queryKey: ['gear-cart-check'] });
    },
  });
}

/**
 * Clear entire cart.
 */
export function useClearCart() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return fetchWithAuth('/api/v1/gear/cart', token!, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gear-cart'] });
      queryClient.invalidateQueries({ queryKey: ['gear-cart-check'] });
    },
  });
}

/**
 * Submit cart items as work order requests.
 */
export function useSubmitCart() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CartSubmitInput): Promise<CartSubmitResponse> => {
      return fetchWithAuth('/api/v1/gear/cart/submit', token!, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      // Invalidate cart and work order request queries
      queryClient.invalidateQueries({ queryKey: ['gear-cart'] });
      queryClient.invalidateQueries({ queryKey: ['gear-cart-check'] });
      queryClient.invalidateQueries({ queryKey: ['work-order-requests'] });
    },
  });
}

// ============================================================================
// COMBINED CART HOOK
// ============================================================================

/**
 * Combined hook that provides cart data and all mutations in one place.
 */
export function useGearCartWithMutations() {
  const cart = useGearCart();
  const addToCart = useAddToCart();
  const updateCartItem = useUpdateCartItem();
  const removeFromCart = useRemoveFromCart();
  const clearCart = useClearCart();
  const submitCart = useSubmitCart();

  return {
    // Cart data
    ...cart,
    // Mutations
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    submitCart,
    // Loading states
    isMutating:
      addToCart.isPending ||
      updateCartItem.isPending ||
      removeFromCart.isPending ||
      clearCart.isPending ||
      submitCart.isPending,
  };
}
