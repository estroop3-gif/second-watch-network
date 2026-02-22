import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, Plus, Search, Archive, Inbox, RefreshCw, ArrowLeft, Reply,
  Star, Trash2, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmailThreadList from '@/components/crm/EmailThreadList';
import EmailMessage from '@/components/crm/EmailMessage';
import EmailComposer from '@/components/crm/EmailComposer';
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
import { useToast } from '@/hooks/use-toast';
import { normalizeSubject } from '@/lib/emailUtils';
import { formatDateTime } from '@/lib/dateUtils';

type FilterTab = 'inbox' | 'archived' | 'starred';

function buildQuotedReply(messages: any[], threadSubject: string): { quotedHtml: string; quotedLabel: string } | null {
  if (!messages || messages.length === 0) return null;
  const lastMsg = messages[messages.length - 1];
  const dateStr = formatDateTime(lastMsg.created_at);
  const sender = lastMsg.from_address || 'Unknown';
  const quotedLabel = `On ${dateStr}, ${sender} wrote:`;
  const quotedHtml = lastMsg.body_html || `<pre>${lastMsg.body_text || ''}</pre>`;
  return { quotedHtml, quotedLabel };
}

const AdminEmailInbox = () => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [composing, setComposing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Accounts
  const { data: myAccountsData, isLoading: accountsLoading } = useMyAdminEmailAccounts();
  const myAccounts = myAccountsData?.accounts || [];
  const accountId = selectedAccountId || myAccounts[0]?.id || '';
  const selectedAccount = myAccounts.find((a: any) => a.id === accountId);

  // Inbox
  const inboxParams = {
    archived: filterTab === 'archived',
    starred_only: filterTab === 'starred',
    search: searchQuery || undefined,
  };
  const { data: inboxData, isLoading: inboxLoading, refetch: refetchInbox } = useAdminEmailInbox(accountId, inboxParams);
  const threads = inboxData?.threads || [];

  // Thread detail
  const { data: threadData, isLoading: threadLoading } = useAdminEmailThread(selectedThreadId);
  const thread = threadData?.thread;
  const messages = threadData?.messages || [];

  // Actions
  const sendEmail = useSendAdminEmail();
  const markRead = useMarkAdminEmailRead();
  const archiveThread = useArchiveAdminEmailThread();
  const starThread = useStarAdminEmailThread();
  const deleteThread = useDeleteAdminEmailThread();

  // Mark thread as read when selected
  useEffect(() => {
    if (selectedThreadId && thread?.unread_count > 0) {
      markRead.mutate(selectedThreadId);
    }
  }, [selectedThreadId, thread?.unread_count]);

  const handleSelectThread = useCallback((threadId: string) => {
    setSelectedThreadId(threadId);
    setShowReply(false);
    setComposing(false);
  }, []);

  const handleArchive = () => {
    if (!selectedThreadId) return;
    archiveThread.mutate(selectedThreadId, {
      onSuccess: () => {
        toast({ title: 'Thread archived' });
        setSelectedThreadId('');
      },
    });
  };

  const handleStar = () => {
    if (selectedThreadId) {
      starThread.mutate(selectedThreadId);
    }
  };

  const handleDelete = () => {
    if (!selectedThreadId) return;
    const idx = threads.findIndex((t: any) => t.id === selectedThreadId);
    deleteThread.mutate(selectedThreadId, {
      onSuccess: () => {
        const nextThread = threads[idx + 1] || threads[idx - 1];
        setSelectedThreadId(nextThread ? nextThread.id : '');
        toast({ title: 'Thread deleted' });
      },
    });
  };

  const handleSendOverride = useCallback((data: any) => {
    sendEmail.mutate(
      { account_id: accountId, ...data },
      {
        onSuccess: () => {
          toast({ title: 'Email sent' });
          setComposing(false);
        },
        onError: (err: any) => toast({ title: err?.message || 'Failed to send', variant: 'destructive' }),
      }
    );
  }, [accountId, sendEmail, toast]);

  const handleReplyOverride = useCallback((data: any) => {
    if (!selectedThreadId) return;
    sendEmail.mutate(
      { account_id: accountId, thread_id: selectedThreadId, ...data },
      {
        onSuccess: () => {
          toast({ title: 'Reply sent' });
          setShowReply(false);
        },
        onError: (err: any) => toast({ title: err?.message || 'Failed to send', variant: 'destructive' }),
      }
    );
  }, [accountId, selectedThreadId, sendEmail, toast]);

  const filterTabs: { id: FilterTab; label: string; icon: any }[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'starred', label: 'Starred', icon: Star },
  ];

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

  const outerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-charcoal-black flex flex-col overflow-hidden'
    : 'flex flex-col h-[calc(100vh-8.5rem)] min-h-0 overflow-hidden';

  // Determine what to show: compose view, thread detail, or thread list
  const showingCompose = composing && !selectedThreadId;
  const showingThread = !!selectedThreadId;

  return (
    <div className={outerClass}>
      <div className="flex-1 min-h-0 border border-muted-gray/30 rounded-lg overflow-hidden bg-charcoal-black flex flex-col">
        {showingCompose ? (
          /* ──── Compose view ──── */
          <>
            <div className="px-4 pt-3 pb-3 border-b border-muted-gray/30 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setComposing(false)} className="text-muted-gray flex-shrink-0">
                  <ArrowLeft className="h-4 w-4 mr-1" />Back
                </Button>
                <h2 className="text-lg font-medium text-bone-white">
                  New Email from {selectedAccount?.display_name || selectedAccount?.email_address}
                </h2>
              </div>
            </div>
            <ScrollArea className="flex-1 min-h-0 p-4">
              <div className="max-w-3xl mx-auto">
                <EmailComposer
                  onSendOverride={handleSendOverride}
                  isSendPending={sendEmail.isPending}
                  onSent={() => setComposing(false)}
                  onCancel={() => setComposing(false)}
                />
              </div>
            </ScrollArea>
          </>
        ) : !showingThread ? (
          /* ──── Thread list view ──── */
          <>
            {/* Toolbar row */}
            <div className="p-3 border-b border-muted-gray/30 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                {/* Account selector */}
                <Select value={accountId} onValueChange={(v) => { setSelectedAccountId(v); setSelectedThreadId(''); }}>
                  <SelectTrigger className="w-[240px] bg-transparent border-muted-gray/30 text-bone-white text-sm flex-shrink-0">
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

                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
                  <Input
                    ref={searchRef}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search emails..."
                    className="pl-9 bg-muted-gray/10 border-muted-gray/30 text-bone-white text-sm"
                  />
                </div>

                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => refetchInbox()} title="Refresh">
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={() => { setComposing(true); setSelectedThreadId(''); }} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 flex-shrink-0">
                  <Plus className="h-4 w-4 mr-1" />Compose
                </Button>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 flex-wrap">
                {filterTabs.map(tab => (
                  <Button
                    key={tab.id}
                    variant={filterTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => { setFilterTab(tab.id); setSelectedThreadId(''); }}
                    className={`text-xs px-2 py-1 h-7 ${filterTab === tab.id ? 'bg-accent-yellow/20 text-accent-yellow' : 'text-muted-gray'}`}
                  >
                    <tab.icon className="h-3 w-3 mr-1" />
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Thread list */}
            <ScrollArea className="flex-1 min-h-0">
              <EmailThreadList
                threads={threads}
                selectedThreadId={selectedThreadId}
                onSelectThread={handleSelectThread}
                isLoading={inboxLoading}
              />
              {!inboxLoading && threads.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-gray">
                  <Mail className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No {filterTab === 'archived' ? 'archived' : filterTab === 'starred' ? 'starred' : ''} threads</p>
                </div>
              )}
            </ScrollArea>
          </>
        ) : (
          /* ──── Thread detail view ──── */
          <>
            {thread ? (
              <>
                {/* Thread header — email metadata */}
                <div className="px-4 pt-3 pb-3 border-b border-muted-gray/30 space-y-2 flex-shrink-0 overflow-x-hidden">
                  {/* Top row: back + actions */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId('')} className="text-muted-gray flex-shrink-0">
                      <ArrowLeft className="h-4 w-4 mr-1" />Back
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => refetchInbox()} title="Refresh">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                      {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Subject line */}
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="text-lg font-medium text-bone-white truncate">{normalizeSubject(thread.subject)}</h2>
                    {thread.is_starred && <Star className="h-4 w-4 text-accent-yellow fill-accent-yellow flex-shrink-0" />}
                  </div>

                  {/* Email metadata */}
                  <div className="space-y-1 text-sm">
                    {(() => {
                      const firstInbound = messages.find((m: any) => m.direction === 'inbound');
                      const originMsg = firstInbound || (messages.length > 0 ? messages[0] : null);
                      const fromAddr = thread.contact_email
                        || firstInbound?.from_address
                        || thread.account_email || 'Unknown';
                      const toAddrs = (originMsg?.to_addresses || []).filter((a: string) => !a.includes('reply+'));
                      const ccAddrs = (originMsg?.cc_addresses || []).filter((a: string) => !a.includes('reply+'));
                      return (
                        <>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-gray w-10 flex-shrink-0">From</span>
                            <span className="text-bone-white truncate">{fromAddr}</span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-gray w-10 flex-shrink-0">To</span>
                            <span className="text-bone-white truncate">
                              {toAddrs.length > 0 ? toAddrs.join(', ') : thread.contact_email || 'Unknown'}
                            </span>
                          </div>
                          {ccAddrs.length > 0 && (
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-muted-gray w-10 flex-shrink-0">CC</span>
                              <span className="text-bone-white/60 truncate">{ccAddrs.join(', ')}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Toolbar */}
                  <div className="flex items-center gap-1 pt-2 border-t border-muted-gray/20 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => setShowReply(!showReply)} className="text-accent-yellow">
                      <Reply className="h-4 w-4 mr-1" />Reply
                    </Button>
                    <div className="w-px h-5 bg-muted-gray/30 mx-1" />
                    <Button variant="ghost" size="sm" onClick={handleStar} className="text-muted-gray" title="Star">
                      <Star className={`h-4 w-4 ${thread.is_starred ? 'text-accent-yellow fill-accent-yellow' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleArchive} className="text-muted-gray" title="Archive">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 min-h-0 p-4">
                  <div className="space-y-4 max-w-3xl mx-auto overflow-x-hidden">
                    {threadLoading ? (
                      <div className="space-y-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="h-32 bg-muted-gray/10 rounded-lg animate-pulse" />
                        ))}
                      </div>
                    ) : (
                      messages.map((msg: any, i: number) => (
                        <EmailMessage
                          key={msg.id}
                          message={msg}
                          defaultExpanded={i === messages.length - 1}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Reply composer */}
                {showReply && (
                  <div className="border-t border-muted-gray/30 p-4 min-h-0 max-h-[50vh] overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                      <EmailComposer
                        compact
                        threadId={selectedThreadId}
                        defaultTo={thread.contact_email}
                        defaultSubject={thread.subject}
                        quotedHtml={buildQuotedReply(messages, thread.subject)?.quotedHtml}
                        quotedLabel={buildQuotedReply(messages, thread.subject)?.quotedLabel}
                        onSendOverride={handleReplyOverride}
                        isSendPending={sendEmail.isPending}
                        onSent={() => setShowReply(false)}
                        onCancel={() => setShowReply(false)}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : threadLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="h-8 w-8 border-2 border-accent-yellow border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-gray">
                <Mail className="h-16 w-16 mb-4 opacity-30" />
                <p className="text-lg font-medium">Thread not found</p>
                <Button variant="ghost" size="sm" onClick={() => setSelectedThreadId('')} className="mt-2 text-accent-yellow">
                  <ArrowLeft className="h-4 w-4 mr-1" />Back to inbox
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminEmailInbox;
