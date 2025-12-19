/**
 * useContacts - Hook for managing project contacts pipeline
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotProjectContact,
  ProjectContactInput,
  ContactFilters,
  BacklotContactType,
  BacklotContactStatus,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface UseContactsOptions extends ContactFilters {
  projectId: string | null;
  limit?: number;
}

export function useContacts(options: UseContactsOptions) {
  const {
    projectId,
    contact_type = 'all',
    status = 'all',
    search,
    limit = 100,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ['backlot-contacts', { projectId, contact_type, status, search, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('limit', String(limit));
      if (contact_type !== 'all') params.append('contact_type', contact_type);
      if (status !== 'all') params.append('status', status);
      if (search) params.append('search', search);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/contacts?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch contacts' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.contacts || []) as BacklotProjectContact[];
    },
    enabled: !!projectId,
  });

  const createContact = useMutation({
    mutationFn: async ({ projectId, ...input }: ProjectContactInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/contacts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create contact' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.contact as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectContactInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/contacts/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update contact' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.contact as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotContactStatus }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/contacts/${id}/status?status=${status}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update status' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.contact as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const logContact = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/contacts/${id}/log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(notes || null),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to log contact' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.contact as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/contacts/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete contact' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  return {
    contacts: data || [],
    isLoading,
    error,
    refetch,
    createContact,
    updateContact,
    updateStatus,
    logContact,
    deleteContact,
  };
}

// Fetch single contact
export function useContact(id: string | null) {
  return useQuery({
    queryKey: ['backlot-contact', id],
    queryFn: async () => {
      if (!id) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/contacts/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch contact' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result.contact as BacklotProjectContact;
    },
    enabled: !!id,
  });
}

// Get contact stats for dashboard
export function useContactStats(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-contact-stats', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/contacts/stats`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch stats' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!projectId,
  });
}
