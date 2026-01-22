import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useMessagesSocket } from '@/hooks/useMessagesSocket';
import { Conversation } from '@/pages/Messages';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Send, User, ArrowLeft, Lock, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Skeleton } from '../ui/skeleton';
import { AttachmentUploader, AttachmentFile } from './AttachmentUploader';
import { MessageAttachments, MessageAttachmentData } from './MessageAttachment';
import * as e2ee from '@/lib/e2ee';

interface MessageViewProps {
  conversation: Conversation;
  onBack?: () => void;
  isMobile?: boolean;
  /** Pre-filled message content (from templates) */
  pendingMessage?: string | null;
  /** Called when the pending message has been used/sent */
  onPendingMessageUsed?: () => void;
  /** Whether E2EE is enabled for this user */
  isE2EEEnabled?: boolean;
}

type Message = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_read: boolean;
  attachments?: MessageAttachmentData[];
  // E2EE fields
  is_encrypted?: boolean;
  ciphertext?: string;
  nonce?: string;
  message_type?: number;  // 1=normal, 2=prekey
  sender_public_key?: string;
  message_number?: number;
};

type DecryptedMessage = Message & {
  decryptedContent?: string;
  decryptionError?: string;
};

export const MessageView = ({
  conversation,
  onBack,
  isMobile,
  pendingMessage,
  onPendingMessageUsed,
  isE2EEEnabled = false,
}: MessageViewProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [canEncryptToRecipient, setCanEncryptToRecipient] = useState(false);
  const [decryptedMessages, setDecryptedMessages] = useState<Map<string, string>>(new Map());
  const [decryptionErrors, setDecryptionErrors] = useState<Map<string, string>>(new Map());
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const markReadDebounceRef = useRef<number | null>(null);
  const hasPendingMessageBeenUsed = useRef(false);

  // Real-time WebSocket subscription for messages
  const { typingUsers, startTyping, stopTyping } = useMessagesSocket({
    conversationId: conversation.id,
    enabled: true,
  });

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: ['messages', conversation.id],
    queryFn: async () => {
      const data = await api.listConversationMessages(conversation.id);
      return data || [];
    },
  });

  // Check if we can encrypt to this recipient
  useEffect(() => {
    if (isE2EEEnabled && conversation.other_participant?.id) {
      e2ee.canEncryptTo(conversation.other_participant.id).then(setCanEncryptToRecipient);
    } else {
      setCanEncryptToRecipient(false);
    }
  }, [isE2EEEnabled, conversation.other_participant?.id]);

  // Decrypt encrypted messages
  useEffect(() => {
    if (!isE2EEEnabled || !messages) return;

    const decryptMessages = async () => {
      const newDecrypted = new Map(decryptedMessages);
      const newErrors = new Map(decryptionErrors);

      for (const message of messages) {
        // Skip if already decrypted or not encrypted
        if (!message.is_encrypted || newDecrypted.has(message.id)) continue;

        try {
          const encrypted: e2ee.EncryptedMessage = {
            ciphertext: message.ciphertext!,
            nonce: message.nonce!,
            isPreKeyMessage: message.message_type === 2,
            senderPublicKey: message.sender_public_key || '',
            messageNumber: message.message_number || 0,
          };
          const plaintext = await e2ee.decryptMessage(message.sender_id, encrypted);
          newDecrypted.set(message.id, plaintext);
          newErrors.delete(message.id);
        } catch (error) {
          console.error(`Failed to decrypt message ${message.id}:`, error);
          newErrors.set(message.id, 'Failed to decrypt');
        }
      }

      setDecryptedMessages(newDecrypted);
      setDecryptionErrors(newErrors);
    };

    decryptMessages();
  }, [isE2EEEnabled, messages]);

  // Get the display content for a message (decrypted if E2EE)
  const getMessageContent = useCallback((message: Message): string => {
    if (message.is_encrypted) {
      if (decryptedMessages.has(message.id)) {
        return decryptedMessages.get(message.id)!;
      }
      if (decryptionErrors.has(message.id)) {
        return '[Unable to decrypt]';
      }
      return '[Decrypting...]';
    }
    return message.content;
  }, [decryptedMessages, decryptionErrors]);

  // Handle input changes with typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (e.target.value.trim()) {
      startTyping();
    }
  }, [startTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  // Handle pending message (from template selection)
  useEffect(() => {
    if (pendingMessage && !hasPendingMessageBeenUsed.current) {
      setNewMessage(pendingMessage);
      hasPendingMessageBeenUsed.current = true;
      // Focus the input so user can edit if needed
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [pendingMessage]);

  // Reset the flag when conversation changes
  useEffect(() => {
    hasPendingMessageBeenUsed.current = false;
  }, [conversation.id]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, messageAttachments }: { content: string; messageAttachments: AttachmentFile[] }) => {
      if (!user) throw new Error('User not authenticated');

      // Check if we should encrypt this message
      const shouldEncrypt = isE2EEEnabled && canEncryptToRecipient && content.trim();

      if (shouldEncrypt) {
        try {
          // Encrypt the message
          const encrypted = await e2ee.encryptMessage(
            conversation.other_participant.id,
            content
          );

          await api.sendMessage(user.id, {
            conversation_id: conversation.id,
            content: '[Encrypted message]',  // Placeholder for non-E2EE clients
            is_encrypted: true,
            encrypted_data: {
              ciphertext: encrypted.ciphertext,
              nonce: encrypted.nonce,
              is_prekey_message: encrypted.isPreKeyMessage,
              sender_public_key: encrypted.senderPublicKey,
              message_number: encrypted.messageNumber,
            },
            attachments: messageAttachments.length > 0 ? messageAttachments.map(a => ({
              id: a.id,
              filename: a.filename,
              original_filename: a.original_filename,
              url: a.url,
              content_type: a.content_type,
              size: a.size,
              type: a.type,
            })) : undefined,
          });
        } catch (encryptError) {
          console.error('Failed to encrypt message:', encryptError);
          // Fall back to unencrypted
          await api.sendMessage(user.id, {
            conversation_id: conversation.id,
            content,
            attachments: messageAttachments.length > 0 ? messageAttachments.map(a => ({
              id: a.id,
              filename: a.filename,
              original_filename: a.original_filename,
              url: a.url,
              content_type: a.content_type,
              size: a.size,
              type: a.type,
            })) : undefined,
          });
        }
      } else {
        // Send unencrypted
        await api.sendMessage(user.id, {
          conversation_id: conversation.id,
          content,
          attachments: messageAttachments.length > 0 ? messageAttachments.map(a => ({
            id: a.id,
            filename: a.filename,
            original_filename: a.original_filename,
            url: a.url,
            content_type: a.content_type,
            size: a.size,
            type: a.type,
          })) : undefined,
        });
      }
    },
    onSuccess: () => {
      setNewMessage('');
      setAttachments([]); // Clear attachments after sending
      stopTyping(); // Stop typing indicator when message is sent
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      // Notify parent that pending message was used (for template cleanup)
      if (onPendingMessageUsed) {
        onPendingMessageUsed();
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMessage.trim() || attachments.length > 0) {
      sendMessageMutation.mutate({
        content: newMessage.trim(),
        messageAttachments: attachments,
      });
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages]);

  // Mark messages as read when scrolled to bottom (debounced)
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await api.markConversationRead(conversation.id, user.id);
      queryClient.invalidateQueries({ queryKey: ['messages', conversation.id] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const handleScrollCheck = () => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (nearBottom) {
      if (markReadDebounceRef.current) window.clearTimeout(markReadDebounceRef.current);
      markReadDebounceRef.current = window.setTimeout(() => {
        markAllAsRead();
      }, 300);
    }
  };

  // Attach scroll handler
  useEffect(() => {
    const el = scrollViewportRef.current;
    if (!el) return;
    const onScroll = () => handleScrollCheck();
    el.addEventListener('scroll', onScroll, { passive: true });
    // initial check
    handleScrollCheck();
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (markReadDebounceRef.current) window.clearTimeout(markReadDebounceRef.current);
    };
  }, [messages]);

  // Compute last outgoing message to show "Seen"
  const lastOutgoing = useMemo(() => {
    if (!messages || !user) return null;
    const mine = messages.filter(m => m.sender_id === user.id);
    return mine.length ? mine[mine.length - 1] : null;
  }, [messages, user]);

  const name = conversation.other_participant.full_name || conversation.other_participant.username || 'User';

  return (
    <div className="flex flex-col h-full bg-charcoal-black overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-muted-gray">
        <div className="flex items-center">
          {isMobile && onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="mr-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <Avatar className="h-9 w-9 mr-3">
            <AvatarImage src={conversation.other_participant.avatar_url || undefined} alt={name} />
            <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="text-md font-semibold text-bone-white truncate">{name}</h2>
          </div>
        </div>
        {/* E2EE indicator */}
        {isE2EEEnabled && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs",
                canEncryptToRecipient
                  ? "bg-green-900/30 text-green-400"
                  : "bg-zinc-800 text-zinc-500"
              )}>
                {canEncryptToRecipient ? (
                  <>
                    <Lock className="h-3 w-3" />
                    <span>Encrypted</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3 w-3" />
                    <span>Not encrypted</span>
                  </>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {canEncryptToRecipient
                ? "Messages are end-to-end encrypted"
                : "Recipient hasn't set up E2EE yet"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <ScrollArea className="flex-1 no-scrollbar overflow-x-hidden" viewportRef={scrollViewportRef}>
        <div className="p-4 space-y-4">
          {isLoading && [...Array(8)].map((_, i) => (
            <div key={i} className={cn("flex items-end gap-2", i % 2 === 0 ? "justify-start" : "justify-end")}>
              {i % 2 === 0 && <Skeleton className="h-8 w-8 rounded-full" />}
              <Skeleton className="h-10 w-48 rounded-lg bg-muted-gray" />
              {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
            </div>
          ))}
          {messages?.map((message) => (
            <div
              key={message.id}
              className={cn('flex items-end gap-2', message.sender_id === user?.id ? 'justify-end' : 'justify-start')}
            >
              {message.sender_id !== user?.id && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={conversation.other_participant.avatar_url || undefined} />
                  <AvatarFallback>{name?.[0] || <User />}</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  'p-3 rounded-lg max-w-xs lg:max-w-md break-words',
                  message.sender_id === user?.id
                    ? 'bg-accent-yellow text-charcoal-black'
                    : 'bg-muted-gray'
                )}
              >
                {/* Message content - use decrypted content for encrypted messages */}
                {(message.content || message.is_encrypted) && (
                  <div className="flex items-start gap-1">
                    {message.is_encrypted && (
                      <Lock className={cn(
                        "h-3 w-3 mt-0.5 flex-shrink-0",
                        message.sender_id === user?.id ? "text-charcoal-black/70" : "text-bone-white/70"
                      )} />
                    )}
                    <p className={cn(
                      "text-sm",
                      decryptionErrors.has(message.id) && "italic text-red-400"
                    )}>
                      {getMessageContent(message)}
                    </p>
                  </div>
                )}
                {message.attachments && message.attachments.length > 0 && (
                  <div className={cn((message.content || message.is_encrypted) && 'mt-2')}>
                    <MessageAttachments attachments={message.attachments} />
                  </div>
                )}
                <p className="text-xs text-right mt-1 opacity-70">
                  {format(new Date(message.created_at), 'p')}
                </p>
              </div>
            </div>
          ))}
          {/* Seen indicator below last outgoing */}
          {lastOutgoing && lastOutgoing.is_read && (
            <div className="text-[11px] text-muted-foreground text-right pr-2">Seen</div>
          )}
          {/* Typing indicator */}
          {typingUsers.size > 0 && (
            <div className="flex items-center gap-2 px-2 py-1">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-gray rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-gray rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-gray rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-muted-gray">
                {Array.from(typingUsers.values()).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
              </span>
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="border-t border-muted-gray">
        <AttachmentUploader
          conversationId={conversation.id}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
          disabled={sendMessageMutation.isPending}
        />
        <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            placeholder="Type a message…"
            autoComplete="off"
            className="bg-muted-gray border-muted-gray focus:ring-accent-yellow"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sendMessageMutation.isPending || (!newMessage.trim() && attachments.length === 0)}
            className="bg-accent-yellow hover:bg-accent-yellow/90"
          >
            <Send className="h-4 w-4 text-charcoal-black" />
          </Button>
        </form>
      </div>
    </div>
  );
};
