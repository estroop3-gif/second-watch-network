import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import {
  Users,
  UserPlus,
  Check,
  X,
  Search,
  Handshake,
  Clock,
  Send,
  Inbox,
  MessageSquare,
  Trash2,
  User,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type TabKey = 'all' | 'pending' | 'sent';

type Connection = {
  id: string;
  requester_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted' | 'denied';
  created_at: string;
  updated_at?: string;
};

type ProfileInfo = {
  id: string;
  full_name: string;
  display_name?: string;
  avatar_url?: string;
  username?: string;
  role?: string;
  location?: string;
};

const Connections = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = (searchParams.get('tab') as TabKey) || 'all';
  const [tab, setTab] = useState<TabKey>(filterParam);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync URL with tab state
  useEffect(() => {
    setTab(filterParam);
  }, [filterParam]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tab);
    setSearchParams(next);
  }, [tab]);

  // Fetch all connections
  const { data: connections = [], isLoading, refetch } = useQuery({
    queryKey: ['connections', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const data = await api.listConnections(user.id);
      return data as Connection[];
    },
  });

  // Fetch profile info for connection partners
  const partnerIds = useMemo(() => {
    if (!user?.id || !connections.length) return [];
    const ids = new Set<string>();
    connections.forEach((c) => {
      if (c.requester_id !== user.id) ids.add(c.requester_id);
      if (c.recipient_id !== user.id) ids.add(c.recipient_id);
    });
    return Array.from(ids);
  }, [connections, user?.id]);

  const { data: profiles = {} } = useQuery({
    queryKey: ['connectionProfiles', partnerIds],
    enabled: partnerIds.length > 0,
    queryFn: async () => {
      const profileMap: Record<string, ProfileInfo> = {};
      // Fetch profiles in parallel
      await Promise.all(
        partnerIds.map(async (id) => {
          try {
            const profile = await api.getProfile(id);
            if (profile) {
              profileMap[id] = profile as ProfileInfo;
            }
          } catch (e) {
            console.error('Failed to fetch profile', id, e);
          }
        })
      );
      return profileMap;
    },
  });

  // Mutations
  const acceptMutation = useMutation({
    mutationFn: (connectionId: string) => api.updateConnection(connectionId, 'accepted'),
    onSuccess: () => {
      toast.success('Connection accepted');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      refetch();
    },
    onError: () => toast.error('Failed to accept connection'),
  });

  const denyMutation = useMutation({
    mutationFn: (connectionId: string) => api.updateConnection(connectionId, 'denied'),
    onSuccess: () => {
      toast.success('Connection declined');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      refetch();
    },
    onError: () => toast.error('Failed to decline connection'),
  });

  const deleteMutation = useMutation({
    mutationFn: (connectionId: string) => api.deleteConnection(connectionId),
    onSuccess: () => {
      toast.success('Connection removed');
      queryClient.invalidateQueries({ queryKey: ['connections'] });
      refetch();
    },
    onError: () => toast.error('Failed to remove connection'),
  });

  // Filter connections by tab and search
  const filteredConnections = useMemo(() => {
    if (!user?.id) return [];

    let filtered = connections;

    // Filter by tab
    switch (tab) {
      case 'pending':
        // Incoming requests (others sent to me)
        filtered = connections.filter(
          (c) => c.status === 'pending' && c.recipient_id === user.id
        );
        break;
      case 'sent':
        // Outgoing requests (I sent to others)
        filtered = connections.filter(
          (c) => c.status === 'pending' && c.requester_id === user.id
        );
        break;
      case 'all':
      default:
        // All accepted connections
        filtered = connections.filter((c) => c.status === 'accepted');
        break;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c) => {
        const partnerId = c.requester_id === user.id ? c.recipient_id : c.requester_id;
        const profile = profiles[partnerId];
        if (!profile) return false;
        return (
          profile.full_name?.toLowerCase().includes(query) ||
          profile.display_name?.toLowerCase().includes(query) ||
          profile.username?.toLowerCase().includes(query)
        );
      });
    }

    return filtered;
  }, [connections, tab, searchQuery, user?.id, profiles]);

  // Count pending incoming
  const pendingCount = useMemo(
    () =>
      connections.filter((c) => c.status === 'pending' && c.recipient_id === user?.id)
        .length,
    [connections, user?.id]
  );

  // Count sent pending
  const sentCount = useMemo(
    () =>
      connections.filter((c) => c.status === 'pending' && c.requester_id === user?.id)
        .length,
    [connections, user?.id]
  );

  const getPartnerId = (c: Connection) =>
    c.requester_id === user?.id ? c.recipient_id : c.requester_id;

  const ConnectionCard = ({ connection }: { connection: Connection }) => {
    const partnerId = getPartnerId(connection);
    const profile = profiles[partnerId];
    const isIncomingPending = connection.status === 'pending' && connection.recipient_id === user?.id;
    const isOutgoingPending = connection.status === 'pending' && connection.requester_id === user?.id;
    const isConnected = connection.status === 'accepted';

    if (!profile) {
      return (
        <Card className="bg-charcoal-gray border-muted-gray">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-charcoal-gray border-muted-gray hover:border-accent-yellow/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/profile/${profile.username || partnerId}`)}
              className="hover:opacity-80 transition-opacity"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
                <AvatarFallback className="bg-muted-gray">
                  <User className="h-6 w-6 text-bone-white" />
                </AvatarFallback>
              </Avatar>
            </button>

            <div className="flex-1 min-w-0">
              <button
                onClick={() => navigate(`/profile/${profile.username || partnerId}`)}
                className="hover:text-accent-yellow transition-colors text-left"
              >
                <h3 className="font-medium text-bone-white truncate">
                  {profile.full_name || profile.display_name || 'Unknown'}
                </h3>
              </button>
              <div className="flex items-center gap-2 text-sm text-muted-gray">
                {profile.role && <span>{profile.role}</span>}
                {profile.role && profile.location && <span>•</span>}
                {profile.location && <span>{profile.location}</span>}
              </div>
              {isConnected && connection.updated_at && (
                <p className="text-xs text-muted-gray mt-1">
                  Connected {formatDistanceToNow(new Date(connection.updated_at), { addSuffix: true })}
                </p>
              )}
              {(isIncomingPending || isOutgoingPending) && (
                <p className="text-xs text-muted-gray mt-1">
                  <Clock className="inline h-3 w-3 mr-1" />
                  Requested {formatDistanceToNow(new Date(connection.created_at), { addSuffix: true })}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isIncomingPending && (
                <>
                  <Button
                    size="sm"
                    variant="default"
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => acceptMutation.mutate(connection.id)}
                    disabled={acceptMutation.isPending}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    onClick={() => denyMutation.mutate(connection.id)}
                    disabled={denyMutation.isPending}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Decline
                  </Button>
                </>
              )}

              {isOutgoingPending && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-muted-gray text-muted-gray hover:bg-muted-gray/20"
                    >
                      Cancel Request
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-charcoal-gray border-muted-gray">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel Connection Request?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel your pending connection request to {profile.full_name}.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-muted-gray">Keep</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => deleteMutation.mutate(connection.id)}
                      >
                        Cancel Request
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {isConnected && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-muted-gray hover:border-accent-yellow"
                    onClick={() => navigate('/messages')}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-muted-gray text-muted-gray hover:border-red-500/50 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-charcoal-gray border-muted-gray">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Connection?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {profile.full_name} from your connections?
                          They won't be notified.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-muted-gray">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-red-600 hover:bg-red-700"
                          onClick={() => deleteMutation.mutate(connection.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const EmptyState = () => {
    const messages: Record<TabKey, { icon: React.ReactNode; title: string; description: string }> = {
      all: {
        icon: <Handshake className="h-12 w-12 text-muted-gray" />,
        title: 'No connections yet',
        description: 'Start connecting with other filmmakers in the community.',
      },
      pending: {
        icon: <Inbox className="h-12 w-12 text-muted-gray" />,
        title: 'No pending requests',
        description: "You don't have any incoming connection requests.",
      },
      sent: {
        icon: <Send className="h-12 w-12 text-muted-gray" />,
        title: 'No sent requests',
        description: "You haven't sent any connection requests.",
      },
    };

    const content = messages[tab];

    return (
      <div className="text-center py-12">
        <div className="flex justify-center mb-4">{content.icon}</div>
        <h3 className="text-lg font-medium text-bone-white mb-2">{content.title}</h3>
        <p className="text-muted-gray mb-6">{content.description}</p>
        {tab === 'all' && (
          <Button onClick={() => navigate('/filmmakers')} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <Users className="h-4 w-4 mr-2" />
            Browse Community
          </Button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-heading tracking-tight text-bone-white mb-2">
          <Users className="inline h-8 w-8 mr-3 text-accent-yellow" />
          My Connections
        </h1>
        <p className="text-muted-gray">Manage your network of filmmakers and collaborators.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="mb-6">
        <TabsList className="bg-charcoal-gray border border-muted-gray">
          <TabsTrigger value="all" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Handshake className="h-4 w-4 mr-2" />
            Connected
          </TabsTrigger>
          <TabsTrigger value="pending" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Inbox className="h-4 w-4 mr-2" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-accent-yellow text-charcoal-black">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="data-[state=active]:bg-accent-yellow data-[state=active]:text-charcoal-black">
            <Send className="h-4 w-4 mr-2" />
            Sent
            {sentCount > 0 && (
              <Badge variant="secondary" className="ml-2 bg-muted-gray text-bone-white">
                {sentCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search connections..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-charcoal-gray border-muted-gray focus:border-accent-yellow"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filteredConnections.length === 0 ? (
          <EmptyState />
        ) : (
          filteredConnections.map((connection) => (
            <ConnectionCard key={connection.id} connection={connection} />
          ))
        )}
      </div>
    </div>
  );
};

export default Connections;
