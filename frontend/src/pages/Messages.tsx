import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ConversationList } from '@/components/messages/ConversationList';
import { MessageView } from '@/components/messages/MessageView';
import { ProjectUpdateView } from '@/components/messages/ProjectUpdateView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import { MessageSquarePlus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSocket } from '@/hooks/useSocket';

// Legacy DM conversation type
export type Conversation = {
  id: string;
  last_message_at: string;
  other_participant: {
    id: string;
    username: string;
    avatar_url: string;
    full_name: string;
  };
  last_message: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
};

// Unified inbox types
export type DMInboxItem = {
  id: string;
  type: 'dm';
  project_id: null;
  project_title: null;
  project_thumbnail: null;
  other_participant: {
    id: string;
    username: string;
    avatar_url: string;
    full_name: string;
  };
  last_message: string | null;
  last_message_at: string;
  update_type: null;
  unread_count: number;
};

export type ProjectInboxItem = {
  id: string;
  type: 'project';
  project_id: string;
  project_title: string;
  project_thumbnail: string | null;
  other_participant: null;
  last_message: string | null;
  last_message_at: string;
  update_type: 'announcement' | 'milestone' | 'schedule_change' | 'general' | null;
  unread_count: number;
};

export type InboxItem = DMInboxItem | ProjectInboxItem;

// Helper to parse selection ID
const parseSelectionId = (id: string | null): { type: 'dm' | 'project' | null; id: string | null } => {
  if (!id) return { type: null, id: null };
  if (id.startsWith('project:')) {
    return { type: 'project', id: id.replace('project:', '') };
  }
  return { type: 'dm', id };
};

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectionIdFromUrl = searchParams.get('id') || searchParams.get('open');
  const [selectedId, setSelectedId] = useState<string | null>(selectionIdFromUrl);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const isMobile = useIsMobile();
  const { emit, on, off, isConnected } = useSocket();

  // Fetch unified inbox (DMs + Project Updates)
  const { data: inboxItems, isLoading } = useQuery<InboxItem[]>({
    queryKey: ['inbox', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await api.getUnifiedInbox(user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Subscribe to project update rooms for real-time
  useEffect(() => {
    if (!isConnected || !inboxItems || !emit) return;

    const projects = inboxItems.filter((item): item is ProjectInboxItem => item.type === 'project');
    projects.forEach((p) => {
      emit('join_project_updates', { project_id: p.project_id });
    });

    return () => {
      projects.forEach((p) => {
        emit('leave_project_updates', { project_id: p.project_id });
      });
    };
  }, [isConnected, inboxItems, emit]);

  // Handle real-time project updates
  useEffect(() => {
    if (!on || !off) return;

    const handleNewUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    };

    on('project_new_update', handleNewUpdate);
    return () => off('project_new_update', handleNewUpdate);
  }, [on, off, queryClient]);

  useEffect(() => {
    if (selectionIdFromUrl) {
      setSelectedId(selectionIdFromUrl);
    }
  }, [selectionIdFromUrl]);

  const handleSelectItem = (id: string) => {
    setSelectedId(id);
    setSearchParams({ id });
  };

  const handleBackToList = () => {
    setSelectedId(null);
    setSearchParams({});
  };

  // Parse selection to determine view type
  const selection = parseSelectionId(selectedId);

  // Find selected DM conversation for MessageView
  const selectedDMConversation = useMemo(() => {
    if (selection.type !== 'dm' || !inboxItems) return null;
    const dmItem = inboxItems.find(
      (item): item is DMInboxItem => item.type === 'dm' && item.id === selection.id
    );
    if (!dmItem) return null;
    // Convert to legacy Conversation format for MessageView
    return {
      id: dmItem.id,
      last_message_at: dmItem.last_message_at,
      other_participant: dmItem.other_participant,
      last_message: dmItem.last_message ? {
        content: dmItem.last_message,
        created_at: dmItem.last_message_at,
        sender_id: '',
      } : null,
      unread_count: dmItem.unread_count,
    } as Conversation;
  }, [inboxItems, selection]);

  // Find selected project for ProjectUpdateView
  const selectedProject = useMemo(() => {
    if (selection.type !== 'project' || !inboxItems) return null;
    return inboxItems.find(
      (item): item is ProjectInboxItem => item.type === 'project' && item.project_id === selection.id
    ) || null;
  }, [inboxItems, selection]);

  const showListOnMobile = !isMobile || (!selectedDMConversation && !selectedProject);

  return (
    <>
      <NewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={() => setIsNewMessageModalOpen(false)}
        onConversationCreated={(id) => {
          handleSelectItem(id);
          setIsNewMessageModalOpen(false);
        }}
      />
      <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 flex flex-col flex-grow">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-bone-white">Messages</h1>
          <Button onClick={() => setIsNewMessageModalOpen(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New Message
          </Button>
        </div>
        <Card className="flex-grow bg-charcoal-black border-muted-gray text-bone-white overflow-hidden flex">
          {showListOnMobile && (
            <div className="w-full max-w-xs md:max-w-sm flex-shrink-0 border-r border-muted-gray flex flex-col overflow-x-hidden">
              <ConversationList
                items={inboxItems || []}
                selectedId={selectedId}
                onSelectItem={handleSelectItem}
                isLoading={isLoading}
              />
            </div>
          )}
          <div className="flex-1 flex flex-col">
            {selection.type === 'project' && selectedProject ? (
              <ProjectUpdateView
                projectId={selectedProject.project_id}
                projectTitle={selectedProject.project_title}
                projectThumbnail={selectedProject.project_thumbnail}
                isMobile={isMobile}
                onBack={isMobile ? handleBackToList : undefined}
              />
            ) : selection.type === 'dm' && selectedDMConversation ? (
              <MessageView
                conversation={selectedDMConversation}
                key={selectedDMConversation.id}
                isMobile={isMobile}
                onBack={isMobile ? handleBackToList : undefined}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Select a conversation or start a new one.</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
};

export default Messages;
