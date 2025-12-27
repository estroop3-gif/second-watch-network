import { useNotifications } from '@/hooks/useNotifications.tsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Bell, Check, Mail, MessageSquare, UserPlus, CheckCircle2, XCircle, ClipboardList, Star, Video, Gift, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState, useMemo, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';

type TabKey = 'all' | 'unread' | 'messages' | 'requests' | 'submissions';

const NotificationIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'message':
      return <MessageSquare className="h-5 w-5 text-muted-gray" />;
    case 'connection.request':
    case 'connection_request':
      return <UserPlus className="h-5 w-5 text-muted-gray" />;
    case 'connection.accepted':
    case 'connection_accept':
      return <CheckCircle2 className="h-5 w-5 text-muted-gray" />;
    case 'connection.denied':
    case 'connection_denied':
      return <XCircle className="h-5 w-5 text-muted-gray" />;
    case 'submission':
    case 'submission_received':
    case 'submission_updated':
      return <Mail className="h-5 w-5 text-muted-gray" />;
    // Application notifications
    case 'role_application':
      return <ClipboardList className="h-5 w-5 text-blue-400" />;
    case 'application_shortlisted':
      return <Star className="h-5 w-5 text-yellow-400" />;
    case 'application_interview':
      return <Video className="h-5 w-5 text-purple-400" />;
    case 'application_offered':
      return <Gift className="h-5 w-5 text-green-400" />;
    case 'application_booked':
      return <Briefcase className="h-5 w-5 text-accent-yellow" />;
    case 'application_rejected':
      return <XCircle className="h-5 w-5 text-red-400" />;
    default:
      return <Bell className="h-5 w-5 text-muted-gray" />;
  }
};

const typeToTab = (type?: string): TabKey => {
  if (!type) return 'all';
  const t = type.toLowerCase();
  if (t.startsWith('connection')) return 'requests';
  if (t.startsWith('message')) return 'messages';
  if (t.startsWith('submission')) return 'submissions';
  return 'all';
};

const Notifications = () => {
  const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount, refresh, counts } = useNotifications();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = (searchParams.get('filter') as TabKey) || (searchParams.get('tab') as TabKey) || 'all';
  const [tab, setTab] = useState<TabKey>(filterParam);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isFiltering, setIsFiltering] = useState(false);

  // keep URL -> state in sync
  useEffect(() => {
    setTab(filterParam);
  }, [filterParam]);

  // push state -> URL (sync both 'filter' and 'tab' for backward-compat)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('filter', tab);
    next.set('tab', tab); // maintain legacy support
    setSearchParams(next);
  }, [tab]);

  // Show a lightweight skeleton when changing filter for better feedback
  useEffect(() => {
    setIsFiltering(true);
    const t = setTimeout(() => setIsFiltering(false), 150);
    return () => clearTimeout(t);
  }, [tab]);

  const handleNotificationClick = (n: any) => {
    if (n.status === 'unread') {
      markAsRead(n.id);
    }
    const t = (n.type || '').toLowerCase();
    // Prefer payload fields if present
    const conversationId = n.related_id || n.payload?.conversationId;
    const submissionId = n.related_id || n.payload?.submissionId;
    const requestId = n.related_id || n.payload?.requestId;
    const projectId = n.payload?.project_id || n.data?.project_id;
    const roleId = n.payload?.role_id || n.data?.role_id;
    const applicationId = n.payload?.application_id || n.data?.application_id;

    if (t.startsWith('message') && conversationId) {
      navigate(`/messages?open=${conversationId}`);
      return;
    }
    if (t.startsWith('connection') && requestId) {
      setTab('requests');
      setSearchParams({ tab: 'requests', focus: requestId });
      return;
    }
    if (t.startsWith('submission') && submissionId) {
      navigate(`/submissions/${submissionId}`);
      return;
    }
    // Application notifications for project owners/admins
    if (t === 'role_application' && projectId) {
      navigate(`/backlot/${projectId}/workspace/cast-crew?tab=role-postings&roleId=${roleId}`);
      return;
    }
    // Application notifications for applicants
    if (t.startsWith('application_') && applicationId) {
      navigate('/backlot/my-applications');
      return;
    }
    // Fallback
    navigate('/notifications');
  };

  const filtered = useMemo(() => {
    if (!notifications) return [];
    return notifications.filter((n) => {
      if (tab === 'all') return true;
      if (tab === 'unread') return n.status === 'unread';
      if (tab === 'messages') return (n.type || '').toLowerCase().startsWith('message');
      if (tab === 'requests') return (n.type || '').toLowerCase().startsWith('connection');
      if (tab === 'submissions') return (n.type || '').toLowerCase().startsWith('submission');
      return true;
    });
  }, [notifications, tab]);

  const focusId = searchParams.get('focus');

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const selectAllInView = () => {
    setSelectedIds(new Set(filtered.map(n => n.id)));
  };
  const clearSelection = () => setSelectedIds(new Set());
  const markSelectedRead = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      await api.markNotificationsRead(ids);
    } catch (error) {
      console.error('Failed to mark notifications as read:', error);
    }
    clearSelection();
    refresh();
  };

  // Inline actions for connection requests
  const acceptRequest = async (requestId: string) => {
    try {
      await api.updateConnection(requestId, 'accepted');
      refresh();
    } catch (error) {
      console.error('Failed to accept request:', error);
    }
  };
  const denyRequest = async (requestId: string) => {
    try {
      await api.updateConnection(requestId, 'denied');
      refresh();
    } catch (error) {
      console.error('Failed to deny request:', error);
    }
  };

  const RequestsActions = ({ item }: { item: any }) => {
    const requestId = item.related_id || item.payload?.requestId;
    if (!requestId) return null;
    return (
      <div className="flex gap-2">
        <Button size="sm" className="bg-accent-yellow text-charcoal-black" onClick={(e) => { e.stopPropagation(); acceptRequest(requestId); }}>
          Accept
        </Button>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); denyRequest(requestId); }}>
          Deny
        </Button>
      </div>
    );
  };

  // Submission grouping (by related_id/payload.submissionId)
  const groupedSubmissions = useMemo(() => {
    if (tab !== 'submissions') return null;
    const map = new Map<string, any[]>();
    filtered.forEach((n) => {
      const id = n.related_id || n.payload?.submissionId;
      if (!id) return;
      const arr = map.get(id) || [];
      arr.push(n);
      map.set(id, arr);
    });
    // Sort each group by created_at desc
    for (const [k, arr] of map) {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      map.set(k, arr);
    }
    return map;
  }, [filtered, tab]);

  const statusChip = (title?: string) => {
    const t = (title || "").toLowerCase();
    if (t.includes('approved')) return <Badge variant="partner">Approved</Badge>;
    if (t.includes('denied') || t.includes('rejected')) return <Badge variant="destructive">Rejected</Badge>;
    if (t.includes('considered') || t.includes('review')) return <Badge variant="secondary">In Review</Badge>;
    return <Badge>Received</Badge>;
  };

  return (
    <div className="container mx-auto max-w-3xl py-12">
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-3xl text-bone-white">Notifications</CardTitle>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button variant="outline" onClick={markSelectedRead}>
                  <Check className="mr-2 h-4 w-4" />
                  Mark selected read ({selectedIds.size})
                </Button>
                <Button variant="ghost" onClick={clearSelection}>Clear</Button>
              </>
            )}
            {unreadCount > 0 && (
              <Button variant="outline" onClick={() => markAllAsRead(tab)}>
                <Check className="mr-2 h-4 w-4" />
                Mark {tab === 'all' ? 'all' : tab} as read
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Desktop/Tablet filters (unchanged) */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="hidden sm:block w-full mb-4">
            <TabsList className="grid w-full grid-cols-5 bg-muted-gray/10">
              <TabsTrigger value="all">
                All {counts?.total ? <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-muted-gray/30 px-1 text-xs">{counts.total}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
              <TabsTrigger value="messages">
                Messages {counts?.messages ? <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-muted-gray/30 px-1 text-xs">{counts.messages}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="requests">
                Requests {counts?.connection_requests ? <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-muted-gray/30 px-1 text-xs">{counts.connection_requests}</span> : null}
              </TabsTrigger>
              <TabsTrigger value="submissions">
                Submissions {counts?.submission_updates ? <span className="ml-2 inline-flex min-w-[18px] justify-center rounded-full bg-muted-gray/30 px-1 text-xs">{counts.submission_updates}</span> : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Mobile filter + overflow */}
          <div className="sm:hidden mb-4">
            <label htmlFor="mobile-filter" className="block text-sm font-medium text-bone-white mb-2">
              Filter
            </label>
            <div className="flex items-center gap-2">
              <Select value={tab} onValueChange={(v) => setTab(v as TabKey)}>
                <SelectTrigger id="mobile-filter" aria-label="Filter notifications" className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="messages">Messages</SelectItem>
                  <SelectItem value="requests">Requests</SelectItem>
                  <SelectItem value="submissions">Submissions</SelectItem>
                </SelectContent>
              </Select>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[180px]">
                  <DropdownMenuItem onClick={() => markAllAsRead(tab)}>
                    Mark all as read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/account/notification-settings')}>
                    Notification settings
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Live region announcing results */}
          <div className="sr-only" aria-live="polite">
            {`Showing ${(filtered || []).length} ${tab} notifications`}
          </div>

          <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar">
            {isLoading || isFiltering ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 p-4 min-h-[56px]">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2 w-full">
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-4 w-[60%]" />
                  </div>
                </div>
              ))
            ) : tab === 'submissions' && groupedSubmissions && groupedSubmissions.size > 0 ? (
              Array.from(groupedSubmissions.entries()).map(([submissionId, items]) => {
                const latest = items[0];
                const isFocused = focusId && (latest.related_id === focusId || latest.payload?.submissionId === focusId);
                const expanded = expandedGroups.has(submissionId);
                return (
                  <div key={submissionId} className={cn("rounded-lg p-3 transition-colors min-h-[56px] sm:min-h-0", isFocused ? "ring-2 ring-accent-yellow" : "hover:bg-muted-gray/10")}>
                    <div className="flex items-start gap-3 cursor-pointer" onClick={() => handleNotificationClick(latest)}>
                      <div className="pt-1">{statusChip(latest.title)}</div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn("font-semibold sm:truncate", latest.status === 'unread' ? 'text-bone-white' : 'text-muted-gray')}
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {latest.title}
                        </p>
                        {latest.body && (
                          <p className={cn("text-sm sm:truncate", latest.status === 'unread' ? 'text-bone-white/80' : 'text-muted-gray/80')}
                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          >
                            {latest.body}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedGroups(prev => {
                              const next = new Set(prev);
                              if (next.has(submissionId)) next.delete(submissionId); else next.add(submissionId);
                              return next;
                            });
                          }}
                        >
                          {expanded ? "Hide history" : "Show history"}
                        </Button>
                        <Checkbox
                          checked={selectedIds.has(latest.id)}
                          onCheckedChange={(v) => {
                            if (typeof v === 'boolean' && v) toggleSelect(latest.id);
                            if (v === false) toggleSelect(latest.id);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Select notification"
                        />
                      </div>
                    </div>
                    {expanded && items.slice(1).map((n) => (
                      <div key={n.id} className="mt-2 ml-8 flex items-start gap-3 p-2 rounded hover:bg-muted-gray/10 min-h-[44px]">
                        <div className="pt-1">{statusChip(n.title)}</div>
                        <div className="flex-1 min-w-0" onClick={() => handleNotificationClick(n)}>
                          <p className={cn("text-sm sm:truncate", n.status === 'unread' ? 'text-bone-white' : 'text-muted-gray')}
                            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className={cn("text-xs sm:truncate", n.status === 'unread' ? 'text-bone-white/80' : 'text-muted-gray/80')}
                              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                            >
                              {n.body}
                            </p>
                          )}
                        </div>
                        <Checkbox
                          checked={selectedIds.has(n.id)}
                          onCheckedChange={(v) => {
                            if (typeof v === 'boolean' && v) toggleSelect(n.id);
                            if (v === false) toggleSelect(n.id);
                          }}
                          aria-label="Select notification"
                        />
                      </div>
                    ))}
                  </div>
                );
              })
            ) : filtered && filtered.length > 0 ? (
              filtered.map((notification) => {
                const isFocused = focusId && (notification.related_id === focusId || notification.payload?.requestId === focusId);
                return (
                  <div
                    key={notification.id}
                    className={cn("flex items-start gap-4 p-4 rounded-lg transition-colors overflow-hidden min-h-[56px] sm:min-h-0",
                      notification.status === 'unread' ? 'bg-muted-gray/20 hover:bg-muted-gray/30' : 'hover:bg-muted-gray/10',
                      isFocused ? 'ring-2 ring-accent-yellow' : ''
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.has(notification.id)}
                      onCheckedChange={(v) => {
                        if (typeof v === 'boolean' && v) toggleSelect(notification.id);
                        if (v === false) toggleSelect(notification.id);
                      }}
                      className="mt-1"
                      aria-label="Select notification"
                    />
                    <div className="mt-1">
                      <NotificationIcon type={notification.type} />
                    </div>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleNotificationClick(notification)}>
                      <p
                        className={cn("font-semibold sm:truncate", notification.status === 'unread' ? 'text-bone-white' : 'text-muted-gray')}
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {notification.title}
                      </p>
                      {notification.body && (
                        <p className={cn("text-sm sm:truncate", notification.status === 'unread' ? 'text-bone-white/80' : 'text-muted-gray/80')}
                          style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                        >
                          {notification.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-gray mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {tab === 'requests' && (notification.type?.toLowerCase().startsWith('connection')) && (
                      <RequestsActions item={notification} />
                    )}
                    {notification.status === 'unread' && (
                      <div className="h-3 w-3 rounded-full bg-blue-500 mt-2 flex-shrink-0" title="Unread"></div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16">
                <Bell className="mx-auto h-12 w-12 text-muted-gray" />
                <h3 className="mt-4 text-lg font-semibold text-bone-white">No notifications</h3>
                <p className="mt-1 text-sm text-muted-gray">We'll let you know when something new happens.</p>
              </div>
            )}
            {filtered.length > 0 && selectedIds.size !== filtered.length && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" onClick={selectAllInView}>Select all in view</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;
