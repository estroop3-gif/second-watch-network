/**
 * useContacts - Hook for managing project contacts pipeline
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotProjectContact,
  ProjectContactInput,
  ContactFilters,
  BacklotContactType,
  BacklotContactStatus,
} from '@/types/backlot';

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

      let query = supabase
        .from('backlot_project_contacts')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (contact_type !== 'all') {
        query = query.eq('contact_type', contact_type);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data: contactsData, error } = await query;
      if (error) throw error;
      if (!contactsData || contactsData.length === 0) return [];

      // Fetch profiles for linked users and creators
      const userIds = new Set<string>();
      contactsData.forEach(c => {
        if (c.user_id) userIds.add(c.user_id);
        if (c.created_by) userIds.add(c.created_by);
      });

      let profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .in('id', Array.from(userIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return contactsData.map(contact => ({
        ...contact,
        linked_user: contact.user_id ? profileMap.get(contact.user_id) : null,
        creator: contact.created_by ? profileMap.get(contact.created_by) : null,
      })) as BacklotProjectContact[];
    },
    enabled: !!projectId,
  });

  const createContact = useMutation({
    mutationFn: async ({ projectId, ...input }: ProjectContactInput & { projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_project_contacts')
        .insert({
          project_id: projectId,
          contact_type: input.contact_type || 'other',
          status: input.status || 'new',
          name: input.name,
          company: input.company || null,
          email: input.email || null,
          phone: input.phone || null,
          role_interest: input.role_interest || null,
          notes: input.notes || null,
          last_contact_date: input.last_contact_date || null,
          next_follow_up_date: input.next_follow_up_date || null,
          user_id: input.user_id || null,
          source: input.source || null,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectContactInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.contact_type !== undefined) updateData.contact_type = input.contact_type;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.name !== undefined) updateData.name = input.name;
      if (input.company !== undefined) updateData.company = input.company;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.role_interest !== undefined) updateData.role_interest = input.role_interest;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.last_contact_date !== undefined) updateData.last_contact_date = input.last_contact_date;
      if (input.next_follow_up_date !== undefined) updateData.next_follow_up_date = input.next_follow_up_date;
      if (input.user_id !== undefined) updateData.user_id = input.user_id;
      if (input.source !== undefined) updateData.source = input.source;

      const { data, error } = await supabase
        .from('backlot_project_contacts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotContactStatus }) => {
      const { data, error } = await supabase
        .from('backlot_project_contacts')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const logContact = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const updateData: Record<string, any> = {
        last_contact_date: new Date().toISOString().split('T')[0],
      };
      if (notes) {
        // Append to existing notes
        const { data: existing } = await supabase
          .from('backlot_project_contacts')
          .select('notes')
          .eq('id', id)
          .single();

        const timestamp = new Date().toLocaleDateString();
        const newNote = `[${timestamp}] ${notes}`;
        updateData.notes = existing?.notes
          ? `${existing.notes}\n\n${newNote}`
          : newNote;
      }

      const { data, error } = await supabase
        .from('backlot_project_contacts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_project_contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
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

      const { data: contact, error } = await supabase
        .from('backlot_project_contacts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch profiles
      const userIds = new Set<string>();
      if (contact.user_id) userIds.add(contact.user_id);
      if (contact.created_by) userIds.add(contact.created_by);

      let profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .in('id', Array.from(userIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return {
        ...contact,
        linked_user: contact.user_id ? profileMap.get(contact.user_id) : null,
        creator: contact.created_by ? profileMap.get(contact.created_by) : null,
      } as BacklotProjectContact;
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

      const { data: contacts, error } = await supabase
        .from('backlot_project_contacts')
        .select('contact_type, status')
        .eq('project_id', projectId);

      if (error) throw error;

      const stats = {
        total: contacts?.length || 0,
        by_type: {
          investor: contacts?.filter(c => c.contact_type === 'investor').length || 0,
          crew: contacts?.filter(c => c.contact_type === 'crew').length || 0,
          collaborator: contacts?.filter(c => c.contact_type === 'collaborator').length || 0,
          vendor: contacts?.filter(c => c.contact_type === 'vendor').length || 0,
          talent: contacts?.filter(c => c.contact_type === 'talent').length || 0,
          other: contacts?.filter(c => c.contact_type === 'other').length || 0,
        },
        by_status: {
          new: contacts?.filter(c => c.status === 'new').length || 0,
          contacted: contacts?.filter(c => c.status === 'contacted').length || 0,
          in_discussion: contacts?.filter(c => c.status === 'in_discussion').length || 0,
          confirmed: contacts?.filter(c => c.status === 'confirmed').length || 0,
          declined: contacts?.filter(c => c.status === 'declined').length || 0,
          archived: contacts?.filter(c => c.status === 'archived').length || 0,
        },
        needs_followup: contacts?.filter(c =>
          c.status !== 'confirmed' &&
          c.status !== 'declined' &&
          c.status !== 'archived'
        ).length || 0,
      };

      return stats;
    },
    enabled: !!projectId,
  });
}
