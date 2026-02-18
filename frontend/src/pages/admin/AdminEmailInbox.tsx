import { useState, useCallback } from 'react';
import {
  useMyAdminEmailAccounts,
  useAdminEmailInbox,
  useAdminEmailThread,
  useSendAdminEmail,
  useMarkAdminEmailRead,
  useArchiveAdminEmailThread,
  useStarAdminEmailThread,
  useDeleteAdminEmailThread,
} from '@/hooks/useAdminEmail';
import EmailThreadList from '@/components/crm/EmailThreadList';
import EmailMessage from '@/components/crm/EmailMessage';
import EmailComposer from '@/components/crm/EmailComposer';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Inbox, Archive, Star, PenSquare, Search, ArrowLeft,
  Archive as ArchiveIcon, Star as StarIcon, Trash2, Reply,
} from 'lucide-react';
import { toast } from 'sonner';

type InboxFilter = 'inbox' | 'archived' | 'starred';

const AdminEmailInbox = () => {
  const { data: myAccountsData, isLoading: accountsLoading } = useMyAdminEmailAccounts();
  const myAccounts = myAccountsData?.accounts || [];

  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [filter, setFilter] = useState<InboxFilter>('inbox');
  const [search, setSearch] = useState('');
  const [selectedThreadId, setSelectedThreadId] = useState<string>('');
  const [composing, setComposing] = useState(false);

  // Auto-select first account
  const accountId = selectedAccountId || myAccounts[0]?.id || '';

  const inboxParams = {
    archived: filter === 'archived',
    starred_only: filter === 'starred',
    search: search || undefined,
  };

  const { data: inboxData, isLoading: inboxLoading } = useAdminEmailInbox(accountId, inboxParams);
  const threads = inboxData?.threads || [];

  const { data: threadData, isLoading: threadLoading } = useAdminEmailThread(selectedThreadId);

  const sendEmail = useSendAdminEmail();
  const markRead = useMarkAdminEmailRead();
  const archiveThread = useArchiveAdminEmailThread();
  const starThread = useStarAdminEmailThread();
  const deleteThread = useDeleteAdminEmailThread();

  // Mark thread read when selected
  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setComposing(false);
    const thread = threads.find((t: any) => t.id === threadId);
    if (thread?.unread_count > 0) {
      markRead.mutate(threadId);
    }
  }, [threads, markRead]);

  const handleSendOverride = useCallback((data: any) => {
    sendEmail.mutate(
      {
        account_id: accountId,
        ...data,
      },
      {
        onSuccess: () => {
          toast.success('Email sent');
          setComposing(false);
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to send'),
      }
    );
  }, [accountId, sendEmail]);

  const handleReply = useCallback((data: any) => {
    if (!selectedThreadId) return;
    sendEmail.mutate(
      {
        account_id: accountId,
        thread_id: selectedThreadId,
        ...data,
      },
      {
        onSuccess: () => toast.success('Reply sent'),
        onError: (err: any) => toast.error(err?.message || 'Failed to send'),
      }
    );
  }, [accountId, selectedThreadId, sendEmail]);

  const selectedAccount = myAccounts.find((a: any) => a.id === accountId);

  if (accountsLoading) {
    return <Skeleton className="h-[400px] w-full" />;
  }

  if (myAccounts.length === 0) {
    return (
      <div className="text-center py-16 text-muted-gray">
        <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">No email accounts available</p>
        <p className="text-sm mt-1">Create an admin email account in the Accounts tab first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          {/* Account selector */}
          <Select value={accountId} onValueChange={(v) => { setSelectedAccountId(v); setSelectedThreadId(''); }}>
            <SelectTrigger className="w-[260px] bg-charcoal-black border-muted-gray/50 text-bone-white">
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              {myAccounts.map((acc: any) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.display_name} ({acc.email_address})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filter tabs */}
          <div className="flex gap-0.5 bg-muted-gray/10 rounded-md p-0.5">
            {([
              { id: 'inbox', icon: Inbox, label: 'Inbox' },
              { id: 'archived', icon: Archive, label: 'Archived' },
              { id: 'starred', icon: Star, label: 'Starred' },
            ] as const).map(f => (
              <button
                key={f.id}
                onClick={() => { setFilter(f.id); setSelectedThreadId(''); }}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 text-xs rounded transition-colors',
                  filter === f.id
                    ? 'bg-muted-gray/30 text-bone-white'
                    : 'text-muted-gray hover:text-bone-white'
                )}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 w-48 bg-charcoal-black border-muted-gray/50 text-bone-white h-9"
            />
          </div>

          <Button
            onClick={() => { setComposing(true); setSelectedThreadId(''); }}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 h-9"
          >
            <PenSquare className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      {/* Main split view */}
      <div className="flex gap-0 border border-muted-gray/30 rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 20rem)' }}>
        {/* Thread list */}
        <div className="w-[380px] flex-shrink-0 border-r border-muted-gray/30 overflow-y-auto bg-gray-900/50">
          <EmailThreadList
            threads={threads}
            selectedThreadId={selectedThreadId}
            onSelectThread={handleSelectThread}
            isLoading={inboxLoading}
          />
          {!inboxLoading && threads.length === 0 && (
            <div className="text-center py-12 text-muted-gray text-sm">
              No {filter === 'archived' ? 'archived' : filter === 'starred' ? 'starred' : ''} threads
            </div>
          )}
        </div>

        {/* Detail / Compose panel */}
        <div className="flex-1 overflow-y-auto bg-charcoal-black">
          {composing ? (
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-bone-white">
                  New Email from {selectedAccount?.display_name}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setComposing(false)} className="text-muted-gray">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </div>
              <EmailComposer
                onSendOverride={handleSendOverride}
                isSendPending={sendEmail.isPending}
                onSent={() => setComposing(false)}
                onCancel={() => setComposing(false)}
              />
            </div>
          ) : selectedThreadId && threadData ? (
            <div className="flex flex-col h-full">
              {/* Thread header */}
              <div className="flex items-center justify-between px-6 py-3 border-b border-muted-gray/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId('')} className="text-muted-gray flex-shrink-0 sm:hidden">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg font-medium text-bone-white truncate">
                    {threadData.thread?.subject || '(No subject)'}
                  </h3>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="sm" title="Archive"
                    onClick={() => archiveThread.mutate(selectedThreadId, {
                      onSuccess: () => { toast.success('Thread archived'); setSelectedThreadId(''); },
                    })}>
                    <ArchiveIcon className="h-4 w-4 text-muted-gray" />
                  </Button>
                  <Button variant="ghost" size="sm" title="Star"
                    onClick={() => starThread.mutate(selectedThreadId)}>
                    <StarIcon className={cn('h-4 w-4', threadData.thread?.is_starred ? 'text-accent-yellow fill-accent-yellow' : 'text-muted-gray')} />
                  </Button>
                  <Button variant="ghost" size="sm" title="Delete"
                    onClick={() => deleteThread.mutate(selectedThreadId, {
                      onSuccess: () => { toast.success('Thread deleted'); setSelectedThreadId(''); },
                    })}>
                    <Trash2 className="h-4 w-4 text-muted-gray hover:text-red-400" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {threadLoading ? (
                  <div className="space-y-4">
                    {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
                  </div>
                ) : (
                  threadData.messages?.map((msg: any, i: number) => (
                    <EmailMessage
                      key={msg.id}
                      message={msg}
                      defaultExpanded={i === threadData.messages.length - 1}
                    />
                  ))
                )}
              </div>

              {/* Reply composer */}
              <div className="border-t border-muted-gray/30 p-4">
                <EmailComposer
                  threadId={selectedThreadId}
                  defaultTo={threadData.thread?.contact_email}
                  defaultSubject={`Re: ${threadData.thread?.subject || ''}`}
                  compact
                  onSendOverride={handleReply}
                  isSendPending={sendEmail.isPending}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-gray">
              <div className="text-center">
                <Inbox className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a thread to read or compose a new email</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminEmailInbox;
