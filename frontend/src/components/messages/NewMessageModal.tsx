import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NewMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConversationCreated: (conversationId: string) => void;
}

type ProfileRecipient = {
  id: string;
  username: string | null;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

export const NewMessageModal = ({ isOpen, onClose, onConversationCreated }: NewMessageModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const term = useMemo(() => searchTerm.trim(), [searchTerm]);

  const { data: recipients, isLoading } = useQuery<ProfileRecipient[]>({
    queryKey: ['messaging-recipients', term],
    queryFn: async () => {
      if (!user) return [];
      // Use searchUsers API with larger limit, filtering happens server-side
      const data = await api.searchUsers(term || '', 50);
      // Filter out current user from results
      return (data || []).filter((p: any) => p.id !== user.id).map((p: any) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
      }));
    },
    enabled: isOpen && !!user,
    staleTime: 30_000,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user) throw new Error('User not authenticated');
      const result = await api.createPrivateConversation(user.id, otherUserId);
      return result.conversation_id;
    },
    onSuccess: (newConversationId) => {
      if (newConversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        onConversationCreated(newConversationId);
      } else {
        toast.error('Could not create or find conversation.');
      }
    },
    onError: (error: any) => {
      toast.error(`Failed to start conversation: ${error.message || 'Unknown error'}`);
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>New Message</DialogTitle>
          <DialogDescription>Search anyone and start a conversation.</DialogDescription>
        </DialogHeader>
        <div className="py-3">
          <Input
            placeholder="Search by name or username…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-muted-gray border-muted-gray focus:ring-accent-yellow"
          />
        </div>
        <ScrollArea className="h-[360px] no-scrollbar overflow-x-hidden">
          <div className="pr-3">
            {isLoading ? (
              <div className="flex justify-center items-center h-[240px]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {recipients?.map((r) => {
                  const name = r.display_name || r.full_name || r.username || 'User';
                  const handleClick = () => createConversationMutation.mutate(r.id);
                  const disabled = createConversationMutation.isPending;
                  return (
                    <button
                      key={r.id}
                      className="flex items-center gap-3 p-2 rounded-md text-left transition-colors w-full hover:bg-muted-gray/50 disabled:opacity-50"
                      onClick={handleClick}
                      disabled={disabled}
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={r.avatar_url || undefined} alt={name} />
                        <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <p className="font-semibold truncate text-sm">{name}</p>
                        {r.username && <p className="text-xs text-muted-foreground truncate">@{r.username}</p>}
                      </div>
                      {disabled && <Loader2 className="h-4 w-4 animate-spin" />}
                    </button>
                  );
                })}
                {recipients && recipients.length === 0 && (
                  <p className="text-center text-muted-foreground py-6">No matching users.</p>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
