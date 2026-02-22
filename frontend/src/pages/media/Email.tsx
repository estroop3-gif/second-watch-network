import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Mail, Plus, Search, Archive, ArchiveRestore, Inbox, RefreshCw, ArrowLeft, Reply, ReplyAll,
  Star, Clock, Trash2, Forward, Tag, StickyNote, Sparkles,
  Settings, Keyboard, ArrowUpDown, CheckSquare, Calendar, X, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import EmailThreadList from '@/components/crm/EmailThreadList';
import EmailMessage from '@/components/crm/EmailMessage';
import EmailComposer from '@/components/crm/EmailComposer';
import InternalNotes from '@/components/crm/InternalNotes';
import LabelPicker from '@/components/crm/LabelPicker';
import QuickReplyDropdown from '@/components/crm/QuickReplyDropdown';
import EmailSignatureEditor from '@/components/crm/EmailSignatureEditor';
import EmailShortcutOverlay from '@/components/crm/EmailShortcutOverlay';
import SnoozePopover from '@/components/crm/SnoozePopover';
import { AISummarizeButton, AISentimentBadge } from '@/components/crm/AIEmailTools';
import {
  useEmailInbox, useEmailThread, useUnreadCount, useMarkRead,
  useArchiveThread, useDeleteThread, useStarThread, useBulkThreadAction, useEmailLabels,
  useScheduledEmails, useCancelScheduledEmail, useEmailSocket,
} from '@/hooks/crm/useEmail';
import { useEmailKeyboardShortcuts } from '@/hooks/crm/useEmailKeyboardShortcuts';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { useToast } from '@/hooks/use-toast';
import { normalizeSubject } from '@/lib/emailUtils';
import { formatDateTime } from '@/lib/dateUtils';

type FilterTab = 'inbox' | 'archived' | 'starred' | 'snoozed' | 'scheduled' | 'deleted';

function buildQuotedReply(messages: any[], threadSubject: string): { quotedHtml: string; quotedLabel: string } | null {
  if (!messages || messages.length === 0) return null;
  const lastMsg = messages[messages.length - 1];
  const dateStr = formatDateTime(lastMsg.created_at);
  const sender = lastMsg.from_address || 'Unknown';
  const quotedLabel = `On ${dateStr}, ${sender} wrote:`;
  const quotedHtml = lastMsg.body_html || `<pre>${lastMsg.body_text || ''}</pre>`;
  return { quotedHtml, quotedLabel };
}

const MediaEmail = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedThreadId, setSelectedThreadId] = useState(searchParams.get('thread') || '');
  const [filterTab, setFilterTab] = useState<FilterTab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [showReplyAll, setShowReplyAll] = useState(false);
  const [sortBy, setSortBy] = useState('last_message_at_desc');
  const [labelFilter, setLabelFilter] = useState<string | undefined>(undefined);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [showSignatureEditor, setShowSignatureEditor] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [sentiment, setSentiment] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [replyAllCc, setReplyAllCc] = useState<string[]>([]);

  const searchRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { openCompose } = useEmailCompose();

  // Real-time WebSocket updates for the active thread
  useEmailSocket(selectedThreadId || undefined);

  // Build inbox params based on filter tab
  const inboxParams = {
    archived: filterTab === 'archived',
    starred_only: filterTab === 'starred',
    snoozed: filterTab === 'snoozed',
    deleted: filterTab === 'deleted',
    search: searchQuery || undefined,
    sort_by: sortBy,
    label_id: labelFilter,
  };

  const { data: inboxData, isLoading: inboxLoading, refetch: refetchInbox } = useEmailInbox(
    filterTab === 'scheduled' ? undefined : inboxParams
  );
  const { data: threadData, isLoading: threadLoading } = useEmailThread(selectedThreadId);
  const { data: unreadData } = useUnreadCount();
  const { data: scheduledData } = useScheduledEmails();
  const { data: labelsData } = useEmailLabels();

  const markRead = useMarkRead();
  const archiveThread = useArchiveThread();
  const deleteThread = useDeleteThread();
  const starThread = useStarThread();
  const bulkAction = useBulkThreadAction();
  const cancelScheduled = useCancelScheduledEmail();

  const threads = filterTab === 'scheduled' ? [] : (inboxData?.threads || []);
  const scheduledMessages = scheduledData?.messages || [];
  const thread = threadData?.thread;
  // Filter out loopback messages: when a reply is sent, Resend echoes it back as
  // an inbound message from the same account email. Hide those duplicates.
  const messages = (threadData?.messages || []).filter((m: any) => {
    if (m.direction !== 'inbound') return true;
    if (!thread?.account_email) return true;
    return m.from_address?.toLowerCase() !== thread.account_email.toLowerCase();
  });
  const unreadCount = unreadData?.count || 0;
  const labels = labelsData?.labels || [];

  // Mark thread as read when selected
  useEffect(() => {
    if (selectedThreadId && thread?.unread_count > 0) {
      markRead.mutate(selectedThreadId);
    }
  }, [selectedThreadId, thread?.unread_count]);

  // Update URL params
  useEffect(() => {
    if (selectedThreadId) {
      setSearchParams({ thread: selectedThreadId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }, [selectedThreadId]);

  const handleArchive = () => {
    if (selectedThreadId) {
      archiveThread.mutate(selectedThreadId);
      setSelectedThreadId('');
    }
  };

  const handleDelete = () => {
    if (!selectedThreadId) return;
    const idx = threads.findIndex((t: any) => t.id === selectedThreadId);
    deleteThread.mutate(selectedThreadId, {
      onSuccess: () => {
        const nextThread = threads[idx + 1] || threads[idx - 1];
        setSelectedThreadId(nextThread ? nextThread.id : '');
        toast({ title: filterTab === 'deleted' ? 'Thread restored' : 'Thread moved to Trash' });
      },
    });
  };

  const handleStar = () => {
    if (selectedThreadId) {
      starThread.mutate(selectedThreadId);
    }
  };

  const handleBulkAction = (action: string) => {
    if (selectedThreadIds.length === 0) return;
    bulkAction.mutate({ threadIds: selectedThreadIds, action }, {
      onSuccess: () => {
        toast({ title: `${action} applied to ${selectedThreadIds.length} threads` });
        setSelectedThreadIds([]);
        setBulkMode(false);
      },
    });
  };

  const handleForward = (msg: any) => {
    const fwdBody = `<br><br><div style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 8px; color: #888;">` +
      `<p><strong>---------- Forwarded message ----------</strong></p>` +
      `<p>From: ${msg.from_address}<br>Date: ${formatDateTime(msg.created_at)}<br>Subject: ${msg.subject || thread?.subject || ''}</p>` +
      `<hr>${msg.body_html || msg.body_text || ''}</div>`;
    openCompose({ defaultSubject: `Fwd: ${msg.subject || thread?.subject || ''}`, defaultBody: fwdBody });
  };

  const handleReplyAll = () => {
    if (!thread || !messages.length) return;
    const allAddresses = new Set<string>();
    messages.forEach(m => {
      m.to_addresses?.forEach((a: string) => allAddresses.add(a));
      if (m.cc_addresses) m.cc_addresses.forEach((a: string) => allAddresses.add(a));
      if (m.from_address) allAddresses.add(m.from_address);
    });
    // Remove the contact email (goes in To) and the account email
    allAddresses.delete(thread.contact_email);
    if (thread.account_email) allAddresses.delete(thread.account_email);
    setReplyAllCc(Array.from(allAddresses));
    setShowReplyAll(true);
    setShowReply(true);
  };

  // Keyboard shortcuts
  useEmailKeyboardShortcuts({
    enabled: true,
    onCompose: () => openCompose(),
    onReply: () => { if (selectedThreadId) setShowReply(true); },
    onReplyAll: () => { if (selectedThreadId) handleReplyAll(); },
    onArchive: handleArchive,
    onStar: handleStar,
    onToggleRead: () => { if (selectedThreadId) markRead.mutate(selectedThreadId); },
    onNextThread: () => {
      if (threads.length > 0) {
        const nextIdx = Math.min(selectedIndex + 1, threads.length - 1);
        setSelectedIndex(nextIdx);
        setSelectedThreadId(threads[nextIdx].id);
      }
    },
    onPrevThread: () => {
      if (threads.length > 0) {
        const prevIdx = Math.max(selectedIndex - 1, 0);
        setSelectedIndex(prevIdx);
        setSelectedThreadId(threads[prevIdx].id);
      }
    },
    onOpenThread: () => {
      if (selectedIndex >= 0 && threads[selectedIndex]) {
        setSelectedThreadId(threads[selectedIndex].id);
      }
    },
    onCloseThread: () => { setSelectedThreadId(''); setShowReply(false); },
    onFocusSearch: () => searchRef.current?.focus(),
    onShowHelp: () => setShowShortcuts(true),
  });

  const filterTabs: { id: FilterTab; label: string; icon: any; badge?: number }[] = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, badge: unreadCount },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'snoozed', label: 'Snoozed', icon: Clock },
    { id: 'scheduled', label: 'Scheduled', icon: Calendar, badge: scheduledMessages.length },
    { id: 'deleted', label: 'Trash', icon: Trash2 },
  ];

  const outerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-charcoal-black flex flex-col overflow-hidden'
    : 'flex flex-col h-[calc(100vh-8.5rem)] min-h-0 overflow-hidden';

  return (
    <div className={outerClass}>
      <div className="flex-1 min-h-0 border border-muted-gray/30 rounded-lg overflow-hidden bg-charcoal-black flex flex-col">
        {!selectedThreadId ? (
          <>
            {/* Toolbar row: actions + search */}
            <div className="p-3 border-b border-muted-gray/30 space-y-2 flex-shrink-0">
              <div className="flex items-center gap-2">
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
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts">
                  <Keyboard className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => setShowSignatureEditor(true)} title="Signature settings">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray flex-shrink-0" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button size="sm" onClick={() => openCompose()} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 flex-shrink-0">
                  <Plus className="h-4 w-4 mr-1" />Compose
                </Button>
              </div>
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
                    {tab.badge ? <Badge className="ml-1 bg-accent-yellow text-charcoal-black text-[10px] px-1 py-0 h-4">{tab.badge}</Badge> : null}
                  </Button>
                ))}
              </div>
              {/* Sort + Label filter + Bulk toggle */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-7 text-xs bg-transparent border-muted-gray/30 text-muted-gray flex-1">
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="last_message_at_desc">Newest first</SelectItem>
                    <SelectItem value="last_message_at_asc">Oldest first</SelectItem>
                    <SelectItem value="unread_first">Unread first</SelectItem>
                  </SelectContent>
                </Select>
                {labels.length > 0 && (
                  <Select value={labelFilter || 'all'} onValueChange={v => setLabelFilter(v === 'all' ? undefined : v)}>
                    <SelectTrigger className="h-7 text-xs bg-transparent border-muted-gray/30 text-muted-gray flex-1">
                      <Tag className="h-3 w-3 mr-1" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All labels</SelectItem>
                      {labels.map((l: any) => (
                        <SelectItem key={l.id} value={l.id}>
                          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: l.color }} />
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  variant={bulkMode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setBulkMode(!bulkMode); setSelectedThreadIds([]); }}
                  className={`h-7 px-2 ${bulkMode ? 'bg-accent-yellow/20 text-accent-yellow' : 'text-muted-gray'}`}
                >
                  <CheckSquare className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Bulk actions toolbar */}
            {bulkMode && selectedThreadIds.length > 0 && (
              <div className="px-3 py-2 border-b border-muted-gray/30 flex items-center gap-2 bg-muted-gray/10 flex-shrink-0">
                <span className="text-xs text-muted-gray">{selectedThreadIds.length} selected</span>
                {filterTab === 'deleted' ? (
                  <Button size="sm" variant="ghost" onClick={() => handleBulkAction('restore')} className="h-6 text-xs text-accent-yellow">
                    <ArchiveRestore className="h-3 w-3 mr-1" />Restore
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('archive')} className="h-6 text-xs text-muted-gray">
                      <Archive className="h-3 w-3 mr-1" />Archive
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('read')} className="h-6 text-xs text-muted-gray">
                      Read
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('star')} className="h-6 text-xs text-muted-gray">
                      <Star className="h-3 w-3 mr-1" />Star
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleBulkAction('delete')} className="h-6 text-xs text-red-400">
                      <Trash2 className="h-3 w-3 mr-1" />Delete
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Thread list or scheduled messages */}
            <ScrollArea className="flex-1 min-h-0">
              {filterTab === 'scheduled' ? (
                <div className="divide-y divide-muted-gray/30">
                  {scheduledMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-gray">
                      <Calendar className="h-10 w-10 mb-3 opacity-50" />
                      <p className="text-sm">No scheduled emails</p>
                    </div>
                  ) : scheduledMessages.map((msg: any) => (
                    <div key={msg.id} className="px-4 py-3 hover:bg-muted-gray/20">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-bone-white truncate">{msg.contact_email}</span>
                        <Button size="sm" variant="ghost" onClick={() => cancelScheduled.mutate(msg.id)} className="h-6 text-xs text-red-400">
                          <X className="h-3 w-3 mr-1" />Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted-gray truncate mt-0.5">{msg.subject || msg.thread_subject}</p>
                      <p className="text-xs text-accent-yellow mt-1">
                        <Clock className="h-3 w-3 inline mr-1" />
                        Scheduled for {formatDateTime(msg.scheduled_at, 'MMM d, h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmailThreadList
                  threads={threads}
                  selectedThreadId={selectedThreadId}
                  onSelectThread={(id) => { setSelectedThreadId(id); setShowReply(false); setShowReplyAll(false); }}
                  isLoading={inboxLoading}
                  bulkMode={bulkMode}
                  selectedThreadIds={selectedThreadIds}
                  onToggleSelect={(id) => {
                    setSelectedThreadIds(prev =>
                      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
                    );
                  }}
                  selectedIndex={selectedIndex}
                  isTrash={filterTab === 'deleted'}
                  onDeleteThread={(id) => {
                    deleteThread.mutate(id, {
                      onSuccess: () => toast({ title: 'Thread moved to Trash' }),
                    });
                  }}
                  onRestoreThread={(id) => {
                    deleteThread.mutate(id, {
                      onSuccess: () => toast({ title: 'Thread restored' }),
                    });
                  }}
                />
              )}
            </ScrollArea>
          </>
        ) : (
          <>
            {/* Thread view */}
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
                              {toAddrs.length > 0
                                ? toAddrs.join(', ')
                                : thread.contact_first_name
                                  ? `${thread.contact_first_name} ${thread.contact_last_name || ''}`.trim() + ` <${thread.contact_email}>`
                                  : thread.contact_email}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-gray w-10 flex-shrink-0">CC</span>
                            <span className="text-bone-white/60 truncate">
                              {ccAddrs.length > 0 ? ccAddrs.join(', ') : 'None'}
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* Labels */}
                  {thread.labels && thread.labels.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {thread.labels.map((l: any) => (
                        <Badge key={l.id} className="text-xs px-2 py-0" style={{ backgroundColor: `${l.color}20`, color: l.color, borderColor: l.color }}>
                          {l.name}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Sentiment badge */}
                  {sentiment && <AISentimentBadge sentiment={sentiment} />}

                  {/* Toolbar */}
                  <div className="flex items-center gap-1 pt-2 border-t border-muted-gray/20 flex-wrap">
                    <Button variant="ghost" size="sm" onClick={() => { setShowReply(!showReply); setShowReplyAll(false); }} className="text-accent-yellow">
                      <Reply className="h-4 w-4 mr-1" />Reply
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleReplyAll} className="text-accent-yellow">
                      <ReplyAll className="h-4 w-4 mr-1" />All
                    </Button>
                    <div className="w-px h-5 bg-muted-gray/30 mx-1" />
                    <Button variant="ghost" size="sm" onClick={handleStar} className="text-muted-gray" title="Star">
                      <Star className={`h-4 w-4 ${thread.is_starred ? 'text-accent-yellow fill-accent-yellow' : ''}`} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleArchive} className="text-muted-gray" title="Archive">
                      <Archive className="h-4 w-4" />
                    </Button>
                    {filterTab === 'deleted' ? (
                      <Button variant="ghost" size="sm" onClick={handleDelete} className="text-accent-yellow" title="Restore from Trash">
                        <ArchiveRestore className="h-4 w-4 mr-1" />Restore
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={handleDelete} className="text-red-400 hover:text-red-300 hover:bg-red-400/10" title="Move to Trash">
                        <Trash2 className="h-4 w-4 mr-1" />Delete
                      </Button>
                    )}
                    <SnoozePopover threadId={selectedThreadId} />
                    <LabelPicker threadId={selectedThreadId} currentLabels={thread.labels || []} />
                    <Button variant="ghost" size="sm" onClick={() => setShowNotes(!showNotes)} className="text-muted-gray" title="Internal notes">
                      <StickyNote className="h-4 w-4" />
                    </Button>
                    <AISummarizeButton threadId={selectedThreadId} />
                  </div>
                </div>

                {/* Internal notes section */}
                {showNotes && (
                  <div className="border-b border-muted-gray/30 flex-shrink-0">
                    <InternalNotes threadId={selectedThreadId} currentProfileId="" />
                  </div>
                )}

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
                      messages.map((msg, i) => (
                        <EmailMessage
                          key={msg.id}
                          message={msg}
                          defaultExpanded={i === messages.length - 1}
                          onForward={() => handleForward(msg)}
                          onReply={() => setShowReply(true)}
                          contactId={thread?.contact_id}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Reply composer / Quick replies */}
                {showReply && (
                  <div className="border-t border-muted-gray/30 p-4 min-h-0 max-h-[50vh] overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                      <div className="flex items-center gap-2 mb-2">
                        <QuickReplyDropdown
                          threadId={selectedThreadId}
                          toEmail={thread.contact_email}
                          contactId={thread.contact_id}
                        />
                      </div>
                      <EmailComposer
                        compact
                        threadId={selectedThreadId}
                        defaultTo={thread.contact_email}
                        defaultCc={showReplyAll ? replyAllCc : undefined}
                        defaultSubject={thread.subject}
                        contactId={thread.contact_id}
                        quotedHtml={buildQuotedReply(messages, thread.subject)?.quotedHtml}
                        quotedLabel={buildQuotedReply(messages, thread.subject)?.quotedLabel}
                        onSent={() => { setShowReply(false); setShowReplyAll(false); setReplyAllCc([]); }}
                        onCancel={() => { setShowReply(false); setShowReplyAll(false); setReplyAllCc([]); }}
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

      {/* Dialogs */}
      <EmailSignatureEditor open={showSignatureEditor} onOpenChange={setShowSignatureEditor} />
      <EmailShortcutOverlay open={showShortcuts} onOpenChange={setShowShortcuts} />
    </div>
  );
};

export default MediaEmail;
