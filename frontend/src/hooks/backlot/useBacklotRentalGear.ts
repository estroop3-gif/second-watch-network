/**
 * Hooks for Backlot Rental Gear Integration
 *
 * Fetches and manages rental orders linked to backlot projects.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BacklotRentalSummary } from '@/types/backlot';

interface GearRentalOrder {
  id: string;
  order_number: string;
  status: string;
  rental_start_date: string;
  rental_end_date: string;
  rental_house_org_id: string;
  rental_house_name?: string;
  rental_house_avatar?: string;
  subtotal: number;
  tax_amount: number;
  insurance_amount: number;
  delivery_fee: number;
  total_amount: number;
  items?: Array<{
    id: string;
    asset_id?: string;
    asset_name?: string;
    item_description: string;
    quantity: number;
    quoted_rate: number;
    rate_type: string;
    line_total: number;
    backlot_gear_id?: string;
  }>;
}

/**
 * Fetch all rental orders for a backlot project
 */
export function useProjectRentalOrders(projectId: string) {
  return useQuery({
    queryKey: ['backlot-rental-orders', projectId],
    queryFn: async () => {
      const response = await api.get(`/backlot/projects/${projectId}/rental-orders`);
      return response as GearRentalOrder[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch rental summary (active rentals, costs, upcoming events)
 */
export function useRentalOrderSummary(projectId: string) {
  return useQuery({
    queryKey: ['rental-order-summary', projectId],
    queryFn: async () => {
      const response = await api.get(`/backlot/projects/${projectId}/rental-summary`);
      return response as BacklotRentalSummary;
    },
    enabled: !!projectId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Create a conversation with an organization (e.g., gear house)
 */
export function useMessageGearHouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      subject?: string;
      initial_message: string;
      context_type: 'general' | 'rental_order' | 'quote' | 'support' | 'billing';
      context_id?: string;
    }) => {
      return await api.post('/org-messages/conversations', input);
    },
    onSuccess: () => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: ['org-conversations'] });
    },
  });
}

/**
 * Fetch user's organization conversations
 */
export function useOrgConversations(filters?: {
  status?: string;
  organization_id?: string;
}) {
  const queryParams = new URLSearchParams();
  if (filters?.status) queryParams.append('status', filters.status);
  if (filters?.organization_id) queryParams.append('organization_id', filters.organization_id);

  const queryString = queryParams.toString();

  return useQuery({
    queryKey: ['org-conversations', filters],
    queryFn: async () => {
      const response = await api.get(`/org-messages/conversations${queryString ? `?${queryString}` : ''}`);
      return response as any[];
    },
  });
}

/**
 * Fetch a single conversation with messages
 */
export function useOrgConversation(conversationId: string) {
  return useQuery({
    queryKey: ['org-conversation', conversationId],
    queryFn: async () => {
      const response = await api.get(`/org-messages/conversations/${conversationId}`);
      return response as {
        conversation: any;
        messages: any[];
      };
    },
    enabled: !!conversationId,
  });
}

/**
 * Send a message in a conversation
 */
export function useSendOrgMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      conversation_id: string;
      content: string;
      attachments?: any[];
      is_internal?: boolean;
    }) => {
      const { conversation_id, ...messageData } = input;
      return await api.post(`/org-messages/conversations/${conversation_id}/messages`, messageData);
    },
    onSuccess: (_, variables) => {
      // Invalidate conversation to refetch messages
      queryClient.invalidateQueries({ queryKey: ['org-conversation', variables.conversation_id] });
      queryClient.invalidateQueries({ queryKey: ['org-conversations'] });
    },
  });
}

/**
 * Mark conversation as read
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return await api.post(`/org-messages/conversations/${conversationId}/mark-read`, {});
    },
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['org-conversation', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['org-conversations'] });
    },
  });
}

/**
 * Types for enriched gear item response
 */
export interface EnrichedGearItemResponse {
  gear: any;  // BacklotGearItem
  rental_order?: any;  // GearRentalOrder with items
  work_order?: any;  // GearWorkOrder with items
  organization?: any;  // GearOrganization
  marketplace_settings?: any;  // GearMarketplaceSettings
  assignee?: any;  // Profile
  assigned_day?: any;  // BacklotProductionDay
}

/**
 * Fetch enriched gear item with all related data (rental order, work order, org info)
 */
export function useEnrichedGearItem(gearId: string | null) {
  return useQuery({
    queryKey: ['enriched-gear-item', gearId],
    queryFn: async () => {
      if (!gearId) return null;
      const response = await api.get(`/api/v1/backlot/gear/${gearId}/enriched`);
      return response as EnrichedGearItemResponse;
    },
    enabled: !!gearId,
    staleTime: 30000, // 30 seconds
  });
}
