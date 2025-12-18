import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { ConversationList } from '@/components/messages/ConversationList';
import { MessageView } from '@/components/messages/MessageView';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { NewMessageModal } from '@/components/messages/NewMessageModal';
import { MessageSquarePlus } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

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

const Messages = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const conversationIdFromUrl = searchParams.get('id') || searchParams.get('open');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversationIdFromUrl);
  const [isNewMessageModalOpen, setIsNewMessageModalOpen] = useState(false);
  const isMobile = useIsMobile();

  const { data: conversations, isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await api.listConversations(user.id);
      return data || [];
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (conversationIdFromUrl) {
      setSelectedConversationId(conversationIdFromUrl);
    }
  }, [conversationIdFromUrl]);

  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setSearchParams({ id });
  };

  const handleBackToList = () => {
    setSelectedConversationId(null);
    setSearchParams({});
  };

  const selectedConversation = useMemo(
    () => conversations?.find(c => c.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const showThreadOnlyOnMobile = isMobile && !!selectedConversation;

  return (
    <>
      <NewMessageModal
        isOpen={isNewMessageModalOpen}
        onClose={() => setIsNewMessageModalOpen(false)}
        onConversationCreated={(id) => {
          handleSelectConversation(id);
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
          {!showThreadOnlyOnMobile && (
            <div className="w-full max-w-xs md:max-w-sm flex-shrink-0 border-r border-muted-gray flex flex-col overflow-x-hidden">
              <ConversationList
                conversations={conversations || []}
                selectedConversationId={selectedConversationId}
                onSelectConversation={handleSelectConversation}
                isLoading={isLoading}
              />
            </div>
          )}
          <div className="flex-1 flex flex-col">
            {selectedConversation ? (
              <MessageView
                conversation={selectedConversation}
                key={selectedConversation.id}
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
