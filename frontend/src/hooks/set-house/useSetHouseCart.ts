/**
 * Set House Cart Hook
 * Shopping cart functionality for space rentals
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  SetHouseCartItem,
  SetHouseCartGrouped,
  SetHouseCartResponse,
  CartItemAddInput,
  CartItemUpdateInput,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[Set House Cart API] ${options?.method || 'GET'} ${fullUrl}`);

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
    throw new Error(errorDetail);
  }

  return response.json().catch(() => ({}));
}

export function useSetHouseCart() {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['set-house-cart'],
    queryFn: () => fetchWithAuth('/api/v1/set-house/cart/', token!),
    enabled: !!token,
    select: (data) => ({
      items: data.items as SetHouseCartItem[],
      itemCount: data.item_count as number,
      estimatedTotal: data.estimated_total as number,
    }),
  });

  const addToCart = useMutation({
    mutationFn: (input: CartItemAddInput) =>
      fetchWithAuth('/api/v1/set-house/cart/', token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-cart'] });
    },
  });

  const updateCartItem = useMutation({
    mutationFn: ({ itemId, ...input }: CartItemUpdateInput & { itemId: string }) =>
      fetchWithAuth(`/api/v1/set-house/cart/${itemId}`, token!, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-cart'] });
    },
  });

  const removeFromCart = useMutation({
    mutationFn: (itemId: string) =>
      fetchWithAuth(`/api/v1/set-house/cart/${itemId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-cart'] });
    },
  });

  const clearCart = useMutation({
    mutationFn: () =>
      fetchWithAuth('/api/v1/set-house/cart/', token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-cart'] });
    },
  });

  const checkout = useMutation({
    mutationFn: () =>
      fetchWithAuth('/api/v1/set-house/cart/checkout', token!, {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['set-house-cart'] });
      queryClient.invalidateQueries({ queryKey: ['set-house-work-order-requests'] });
    },
  });

  return {
    items: query.data?.items ?? [],
    itemCount: query.data?.itemCount ?? 0,
    estimatedTotal: query.data?.estimatedTotal ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    checkout,
  };
}

export function useSetHouseCartItemCheck(listingId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  return useQuery({
    queryKey: ['set-house-cart-check', listingId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/cart/check/${listingId}`, token!),
    enabled: !!token && !!listingId,
    select: (data) => ({
      inCart: data.in_cart as boolean,
      cartItemId: data.cart_item_id as string | undefined,
      quantity: data.quantity as number,
    }),
  });
}
