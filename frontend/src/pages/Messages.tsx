import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ConversationList } from '@/components/messages/ConversationList';
import { MessageView } from '@/components/messages/MessageView';
import { ProjectUpdateView } from '@/components/messages/ProjectUpdateView';
import { ChannelView } from '@/components/messages/ChannelView';
import { ApplicantQuickTemplates } from '@/components/messages/ApplicantQuickTemplates';
import { E2EESetup, E2EEBadge } from '@/components/messages/E2EESetup';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useSearchParams } from 'react-router-dom';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import {
  MessageSquarePlus,
  Loader2,
  Inbox,
  Users,
  Film,
  FileUser,
  Crown,
  Clapperboard,
  Package,
  Building2,
  Hash,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  Settings,
  Menu,
} from 'lucide-react';
import { CustomFolderList } from '@/components/messages/CustomFolderList';
import { FolderManagementModal } from '@/components/messages/FolderManagementModal';
import { FolderSettingsPanel } from '@/components/messages/FolderSettingsPanel';
import { useCustomFolders, useFolderConversations } from '@/hooks/useCustomFolders';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSocket } from '@/hooks/useSocket';
import { cn } from '@/lib/utils';
import { isE2EEInitialized, initializeE2EE } from '@/lib/e2ee';

// ============================================================================
// TYPES
// ============================================================================

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
  folder: string;
  context_id: string | null;
  context_metadata: Record<string, any>;
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
  folder: string;
  project_id: string;
  project_title: string;
  project_thumbnail: string | null;
  other_participant: null;
  last_message: string | null;
  last_message_at: string;
  update_type: 'announcement' | 'milestone' | 'schedule_change' | 'general' | null;
  unread_count: number;
};

export type ChannelInboxItem = {
  id: string;
  type: 'channel';
  folder: string;
  name: string;
  slug: string;
  channel_type: string;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
};

export type InboxItem = DMInboxItem | ProjectInboxItem | ChannelInboxItem;

// Folder definitions
const FOLDERS = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'personal', label: 'DMs', icon: Users },
  { id: 'backlot', label: 'Backlot', icon: Film },
  { id: 'application', label: 'Applications', icon: FileUser },
  { id: 'order', label: 'The Order', icon: Crown },
  { id: 'greenroom', label: 'Green Room', icon: Clapperboard },
  { id: 'gear', label: 'Gear House', icon: Package },
  { id: 'set', label: 'Set House', icon: Building2 },
] as const;

type FolderId = typeof FOLDERS[number]['id'] | `custom:${string}`;

// ============================================================================
// HELPERS
// ============================================================================

// Helper to parse selection ID
const parseSelectionId = (id: string | null): { type: 'dm' | 'project' | 'channel' | null; id: string | null } => {
  if (!id) return { type: null, id: null };
  if (id.startsWith('project:')) {
    return { type: 'project', id: id.replace('project:', '') };
  }
  if (id.startsWith('channel:')) {
    return { type: 'channel', id: id.replace('channel:', '') };
  }
  return { type: 'dm', id };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Messages = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get URL parameters
  const selectionIdFromUrl = searchParams.get('id') || searchParams.get('open');
  const targetUserIdFromUrl = searchParams.get('user');
  const contextFromUrl = searchParams.get('context');
  const roleNameFromUrl = searchParams.get('role');
  const recipientNameFromUrl = searchParams.get('name');
  const folderFromUrl = searchParams.get('folder') as FolderId | null;

  const [selectedFolder, setSelectedFolder] = useState<FolderId>(folderFromUrl || 'all');
  const [selectedId, setSelectedId] = useState<string | null>(selectionIdFromUrl);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const [isE2EESetupOpen, setIsE2EESetupOpen] = useState(false);
  const [isLoadingUserConversation, setIsLoadingUserConversation] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null);
  const [isFolderSidebarCollapsed, setIsFolderSidebarCollapsed] = useState(false);
  const [e2eeEnabled, setE2eeEnabled] = useState(false);
  const [showFolderCreateModal, setShowFolderCreateModal] = useState(false);

  // Store conversation data for conversations not yet in inbox (no messages yet)
  const [syntheticConversation, setSyntheticConversation] = useState<{ id: string; other_participant: any } | null>(null);
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [showMobileFolderDrawer, setShowMobileFolderDrawer] = useState(false);

  // Context for quick templates (when coming from applicant page)
  const [applicantContext, setApplicantContext] = useState<{
    recipientName: string;
    roleName: string;
    targetUserId: string;
  } | null>(null);

  const isMobile = useIsMobile();
  const { emit, on, off, isConnected } = useSocket();

  // Initialize E2EE on mount
  useEffect(() => {
    if (user?.id) {
      initializeE2EE(user.id).then(setE2eeEnabled);
    }
  }, [user?.id]);

  // Fetch folder unread counts
  const { data: folderCounts } = useQuery<Record<string, number>>({
    queryKey: ['folder-counts', user?.id],
    queryFn: async () => {
      if (!user?.id) return {};
      return api.getFolderUnreadCounts(user.id);
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch custom folders
  const { data: customFolders } = useCustomFolders();

  // Check if selected folder is a custom folder
  const isCustomFolder = selectedFolder.startsWith('custom:');
  const customFolderId = isCustomFolder ? selectedFolder.replace('custom:', '') : null;

  // Fetch conversations in custom folder (if selected)
  const { data: customFolderConversations } = useFolderConversations(customFolderId);

  // Fetch unified inbox (DMs + Project Updates) filtered by folder
  const { data: inboxItems, isLoading } = useQuery<InboxItem[]>({
    queryKey: ['inbox', user?.id, selectedFolder],
    queryFn: async () => {
      if (!user?.id) return [];
      // Don't fetch inbox for custom folders (we use useFolderConversations instead)
      if (selectedFolder.startsWith('custom:')) return [];
      const folder = selectedFolder === 'all' ? undefined : selectedFolder;
      const data = await api.getUnifiedInbox(user.id, { folder });
      return data || [];
    },
    enabled: !!user?.id && !selectedFolder.startsWith('custom:'),
  });

  // Fetch channels for current folder
  const { data: channels } = useQuery({
    queryKey: ['channels', user?.id, selectedFolder],
    queryFn: async () => {
      if (!user?.id) return [];
      // Only fetch channels for folders that have them
      const channelFolders = ['order', 'greenroom', 'gear', 'set'];
      if (selectedFolder !== 'all' && !channelFolders.includes(selectedFolder)) {
        return [];
      }
      const channelType = selectedFolder === 'all' ? undefined :
        selectedFolder === 'gear' ? 'gear_team' :
        selectedFolder === 'set' ? 'set_team' : selectedFolder;
      return api.listChannels(user.id, { channelType });
    },
    enabled: !!user?.id,
  });

  // Combine inbox items with channels and custom folder conversations
  const combinedItems = useMemo(() => {
    // If viewing a custom folder, use custom folder conversations
    if (isCustomFolder && customFolderConversations) {
      return customFolderConversations.map((conv) => ({
        id: conv.id,
        type: 'dm' as const,
        folder: conv.folder,
        context_id: null,
        context_metadata: {},
        project_id: null,
        project_title: null,
        project_thumbnail: null,
        other_participant: conv.other_participant,
        last_message: conv.last_message,
        last_message_at: conv.last_message_at || '',
        update_type: null,
        unread_count: conv.unread_count,
      })) as DMInboxItem[];
    }

    const items: InboxItem[] = [...(inboxItems || [])];

    // Add channels as inbox items
    if (channels) {
      for (const channel of channels) {
        items.push({
          id: `channel:${channel.id}`,
          type: 'channel',
          folder: channel.channel_type,
          name: channel.name,
          slug: channel.slug,
          channel_type: channel.channel_type,
          last_message: null,
          last_message_at: channel.updated_at || channel.created_at,
          unread_count: channel.unread_count || 0,
        } as ChannelInboxItem);
      }
    }

    // Sort by last message
    items.sort((a, b) => {
      const aTime = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bTime = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bTime - aTime;
    });

    return items;
  }, [inboxItems, channels, isCustomFolder, customFolderConversations]);

  // Handle ?user= URL parameter to auto-open conversation
  useEffect(() => {
    if (!targetUserIdFromUrl || !user?.id || isLoadingUserConversation) return;

    const loadConversation = async () => {
      setIsLoadingUserConversation(true);
      try {
        console.log('[Messages] Getting or creating conversation with user:', targetUserIdFromUrl);
        const result = await api.getOrCreateConversationByUser(targetUserIdFromUrl, user.id);
        console.log('[Messages] Conversation result:', result);

        if (result.conversation_id) {
          setSelectedId(result.conversation_id);

          // Store synthetic conversation data for conversations not yet in inbox
          if (result.target_user) {
            setSyntheticConversation({
              id: result.conversation_id,
              other_participant: {
                id: result.target_user.id,
                username: result.target_user.username,
                full_name: result.target_user.full_name,
                display_name: result.target_user.display_name,
                avatar_url: result.target_user.avatar_url,
              },
            });
          }

          const newParams = new URLSearchParams();
          newParams.set('id', result.conversation_id);

          if (contextFromUrl === 'applicant') {
            setApplicantContext({
              recipientName: recipientNameFromUrl || result.target_user?.full_name || result.target_user?.display_name || 'there',
              roleName: roleNameFromUrl || 'this position',
              targetUserId: targetUserIdFromUrl,
            });
            setSelectedFolder('application');
          }

          setSearchParams(newParams, { replace: true });
          queryClient.invalidateQueries({ queryKey: ['inbox'] });
        } else {
          console.warn('[Messages] No conversation_id returned, opening new message modal');
          toast({
            title: 'Unable to open conversation',
            description: 'Opening new message dialog instead.',
            variant: 'default',
          });
          // If no conversation ID returned, open new message modal instead
          setIsNewMessageModalOpen(true);
          // Clear the user param from URL
          setSearchParams({}, { replace: true });
        }
      } catch (error: any) {
        console.error('[Messages] Failed to load conversation:', error);
        toast({
          title: 'Error loading conversation',
          description: error?.message || 'Could not load the conversation. Opening new message dialog.',
          variant: 'destructive',
        });
        // On error, fall back to opening new message modal
        setIsNewMessageModalOpen(true);
        // Clear the user param from URL to prevent retry loop
        setSearchParams({}, { replace: true });
      } finally {
        setIsLoadingUserConversation(false);
      }
    };

    loadConversation();
  }, [targetUserIdFromUrl, user?.id, contextFromUrl, roleNameFromUrl, recipientNameFromUrl, queryClient, setSearchParams, isLoadingUserConversation]);

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
      queryClient.invalidateQueries({ queryKey: ['folder-counts'] });
    };

    on('project_new_update', handleNewUpdate);
    return () => off('project_new_update', handleNewUpdate);
  }, [on, off, queryClient]);

  useEffect(() => {
    if (selectionIdFromUrl && !targetUserIdFromUrl) {
      setSelectedId(selectionIdFromUrl);
    }
  }, [selectionIdFromUrl, targetUserIdFromUrl]);

  // Clear synthetic conversation once it appears in the inbox (after first message sent)
  useEffect(() => {
    if (syntheticConversation && combinedItems) {
      const existsInInbox = combinedItems.some(
        item => item.type === 'dm' && item.id === syntheticConversation.id
      );
      if (existsInInbox) {
        console.log('[Messages] Conversation now in inbox, clearing synthetic data');
        setSyntheticConversation(null);
      }
    }
  }, [syntheticConversation, combinedItems]);

  const handleSelectFolder = useCallback((folder: FolderId) => {
    setSelectedFolder(folder);
    if (isMobile) {
      setShowMobileFolderDrawer(false);
    }
  }, [isMobile]);

  const handleSelectItem = useCallback((id: string) => {
    setSelectedId(id);
    setSearchParams({ id, folder: selectedFolder });
    setApplicantContext(null);
    // Clear synthetic conversation when manually selecting an item
    setSyntheticConversation(null);
  }, [setSearchParams, selectedFolder]);

  const handleBackToList = useCallback(() => {
    setSelectedId(null);
    setSearchParams({ folder: selectedFolder });
    setApplicantContext(null);
  }, [setSearchParams, selectedFolder]);

  const handleSelectTemplate = useCallback((text: string) => {
    setPendingTemplate(text);
  }, []);

  const handleTemplateUsed = useCallback(() => {
    setPendingTemplate(null);
    setApplicantContext(null);
  }, []);

  // Parse selection to determine view type
  const selection = parseSelectionId(selectedId);

  // Find selected DM conversation for MessageView
  const selectedDMConversation = useMemo(() => {
    if (selection.type !== 'dm' || !combinedItems) return null;
    const dmItem = combinedItems.find(
      (item): item is DMInboxItem => item.type === 'dm' && item.id === selection.id
    );

    // If found in inbox, use that data
    if (dmItem) {
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
    }

    // If not in inbox but we have synthetic conversation data (new conversation with no messages)
    if (syntheticConversation && syntheticConversation.id === selection.id) {
      console.log('[Messages] Using synthetic conversation for:', selection.id);
      return {
        id: syntheticConversation.id,
        last_message_at: new Date().toISOString(),
        other_participant: syntheticConversation.other_participant,
        last_message: null,
        unread_count: 0,
      } as Conversation;
    }

    return null;
  }, [combinedItems, selection, syntheticConversation]);

  // Find selected project for ProjectUpdateView
  const selectedProject = useMemo(() => {
    if (selection.type !== 'project' || !combinedItems) return null;
    return combinedItems.find(
      (item): item is ProjectInboxItem => item.type === 'project' && item.project_id === selection.id
    ) || null;
  }, [combinedItems, selection]);

  // Find selected channel
  const selectedChannel = useMemo(() => {
    if (selection.type !== 'channel' || !combinedItems) return null;
    const channelItem = combinedItems.find(
      (item): item is ChannelInboxItem => item.type === 'channel' && item.id === `channel:${selection.id}`
    );
    return channelItem || null;
  }, [combinedItems, selection]);

  const showListOnMobile = !isMobile || (!selectedDMConversation && !selectedProject && !selectedChannel);

  // Loading state
  if (isLoadingUserConversation) {
    return (
      <div className="fixed inset-0 top-20 flex flex-col bg-charcoal-black overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h1 className="text-3xl font-bold text-bone-white">Messages</h1>
          </div>
          <Card className="flex-1 min-h-0 bg-charcoal-black border-muted-gray text-bone-white overflow-hidden flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
              <p className="text-muted-foreground">Opening conversation...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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
      <E2EESetup
        isOpen={isE2EESetupOpen}
        onClose={() => setIsE2EESetupOpen(false)}
        onSetupComplete={() => setE2eeEnabled(true)}
      />
      <FolderManagementModal
        isOpen={showFolderCreateModal}
        onClose={() => setShowFolderCreateModal(false)}
      />
      <FolderSettingsPanel
        isOpen={showFolderSettings}
        onClose={() => setShowFolderSettings(false)}
        e2eeEnabled={e2eeEnabled}
        onEnableE2EE={() => {
          setShowFolderSettings(false);
          setIsE2EESetupOpen(true);
        }}
      />

      <div className="fixed inset-0 top-20 flex flex-col bg-charcoal-black overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 lg:px-8 py-6 flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
            <h1 className="text-3xl font-bold text-bone-white">Messages</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowFolderSettings(true)}
                title="Message Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <Button onClick={() => setIsNewMessageModalOpen(true)}>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                New Message
              </Button>
            </div>
          </div>

          <Card className="flex-1 min-h-0 bg-charcoal-black border-muted-gray text-bone-white overflow-hidden flex">
          {/* Folder Sidebar */}
          {showListOnMobile && !isMobile && (
            <div className={cn(
              "border-r border-muted-gray flex-shrink-0 flex flex-col transition-all duration-200 overflow-hidden",
              isFolderSidebarCollapsed ? "w-12" : "w-48"
            )}>
              <div className="p-3 border-b border-muted-gray flex items-center justify-between">
                {!isFolderSidebarCollapsed && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Folders
                  </h2>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFolderSidebarCollapsed(!isFolderSidebarCollapsed)}
                  className={cn(
                    "h-6 w-6 text-muted-foreground hover:text-bone-white",
                    isFolderSidebarCollapsed && "mx-auto"
                  )}
                  title={isFolderSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                  {isFolderSidebarCollapsed ? (
                    <PanelLeft className="h-4 w-4" />
                  ) : (
                    <PanelLeftClose className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {FOLDERS.map((folder) => {
                    const Icon = folder.icon;
                    const count = folderCounts?.[folder.id] || 0;
                    const isActive = selectedFolder === folder.id;

                    return (
                      <button
                        key={folder.id}
                        onClick={() => handleSelectFolder(folder.id)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative",
                          isActive
                            ? "bg-accent-yellow/20 text-accent-yellow"
                            : "text-bone-white hover:bg-muted-gray/30",
                          isFolderSidebarCollapsed && "justify-center px-2"
                        )}
                        title={isFolderSidebarCollapsed ? folder.label : undefined}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        {!isFolderSidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left truncate">{folder.label}</span>
                            {count > 0 && (
                              <Badge variant="secondary" className="bg-primary-red text-white text-xs px-1.5 py-0.5 min-w-[20px] text-center">
                                {count > 99 ? '99+' : count}
                              </Badge>
                            )}
                          </>
                        )}
                        {isFolderSidebarCollapsed && count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-primary-red text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">
                            {count > 9 ? '9+' : count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Folders */}
                <CustomFolderList
                  folders={customFolders || []}
                  selectedFolderId={selectedFolder}
                  onSelectFolder={(id) => handleSelectFolder(id as FolderId)}
                  onCreateFolder={() => setShowFolderCreateModal(true)}
                  onManageFolders={() => setShowFolderSettings(true)}
                  isCollapsed={isFolderSidebarCollapsed}
                />
              </ScrollArea>
            </div>
          )}

          {/* Conversation List (Desktop) */}
          {showListOnMobile && !isMobile && (
            <div className="w-72 flex-shrink-0 border-r border-muted-gray flex flex-col overflow-hidden">
              <ConversationList
                items={combinedItems}
                selectedId={selectedId}
                onSelectItem={handleSelectItem}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Mobile: Conversation list with folder drawer */}
          {isMobile && showListOnMobile && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Mobile Folder Header */}
              <div className="flex items-center justify-between p-3 border-b border-muted-gray">
                <Sheet open={showMobileFolderDrawer} onOpenChange={setShowMobileFolderDrawer}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <Menu className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {FOLDERS.find(f => f.id === selectedFolder)?.label || 'All'}
                      </span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="bg-charcoal-black border-r-muted-gray w-[280px] p-0">
                    <SheetHeader className="p-4 border-b border-muted-gray">
                      <SheetTitle className="text-bone-white">Folders</SheetTitle>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-60px)]">
                      <div className="p-2 space-y-1">
                        {FOLDERS.map((folder) => {
                          const Icon = folder.icon;
                          const count = folderCounts?.[folder.id] || 0;
                          const isActive = selectedFolder === folder.id;
                          return (
                            <button
                              key={folder.id}
                              onClick={() => handleSelectFolder(folder.id)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                isActive
                                  ? "bg-accent-yellow/20 text-accent-yellow"
                                  : "text-bone-white hover:bg-muted-gray/30"
                              )}
                            >
                              <Icon className="h-4 w-4 flex-shrink-0" />
                              <span className="flex-1 text-left truncate">{folder.label}</span>
                              {count > 0 && (
                                <Badge variant="secondary" className="bg-primary-red text-white text-xs px-1.5 py-0.5">
                                  {count > 99 ? '99+' : count}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <CustomFolderList
                        folders={customFolders || []}
                        selectedFolderId={selectedFolder}
                        onSelectFolder={(id) => handleSelectFolder(id as FolderId)}
                        onCreateFolder={() => setShowFolderCreateModal(true)}
                        onManageFolders={() => setShowFolderSettings(true)}
                      />
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
              </div>
              {/* Conversation List */}
              <ConversationList
                items={combinedItems}
                selectedId={selectedId}
                onSelectItem={handleSelectItem}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Main Content */}
          {(!isMobile || selectedId) && (
            <div className="flex-1 flex flex-col min-w-0">
              {selection.type === 'project' && selectedProject ? (
                <ProjectUpdateView
                  projectId={selectedProject.project_id}
                  projectTitle={selectedProject.project_title}
                  projectThumbnail={selectedProject.project_thumbnail}
                  isMobile={isMobile}
                  onBack={isMobile ? handleBackToList : undefined}
                />
              ) : selection.type === 'channel' && selectedChannel ? (
                <ChannelView
                  channelId={selection.id!}
                  channelName={selectedChannel.name}
                  isMobile={isMobile}
                  onBack={isMobile ? handleBackToList : undefined}
                />
              ) : selection.type === 'dm' && selectedDMConversation ? (
                <div className="flex flex-col h-full">
                  {applicantContext && (
                    <ApplicantQuickTemplates
                      recipientName={applicantContext.recipientName}
                      roleName={applicantContext.roleName}
                      onSelectTemplate={handleSelectTemplate}
                    />
                  )}
                  <div className="flex-1 min-h-0">
                    <MessageView
                      conversation={selectedDMConversation}
                      key={selectedDMConversation.id}
                      isMobile={isMobile}
                      onBack={isMobile ? handleBackToList : undefined}
                      pendingMessage={pendingTemplate}
                      onPendingMessageUsed={handleTemplateUsed}
                      isE2EEEnabled={e2eeEnabled}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation or start a new one</p>
                  </div>
                </div>
              )}
            </div>
          )}
          </Card>
        </div>
      </div>
    </>
  );
};

export default Messages;
