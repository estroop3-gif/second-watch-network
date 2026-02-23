/**
 * PeopleDirectory - "The Network" tab for discovering and connecting with users
 *
 * Features:
 * - Shows ALL users on the platform
 * - Connection status with Connect/Connected/Message buttons
 * - Search by name/username
 * - Filter by role, Order membership, partner status, location
 */
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useUserDirectory, DirectoryUser } from '@/hooks/useUserDirectory';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LocationAutocomplete, LocationData } from '@/components/ui/location-autocomplete';
import {
  Search,
  Filter,
  X,
  UserPlus,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  Check,
  MapPin,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PeopleDirectoryProps {
  initialFilter?: string;
}

// Role options for filtering
const roleOptions = [
  { id: 'filmmaker', label: 'Filmmaker' },
  { id: 'director', label: 'Director' },
  { id: 'producer', label: 'Producer' },
  { id: 'editor', label: 'Editor' },
  { id: 'cinematographer', label: 'Cinematographer' },
  { id: 'actor', label: 'Actor' },
  { id: 'writer', label: 'Writer' },
  { id: 'composer', label: 'Composer' },
  { id: 'sound', label: 'Sound Designer' },
];

const PeopleDirectory: React.FC<PeopleDirectoryProps> = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  // Filter state
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | undefined>();
  const [orderMembersOnly, setOrderMembersOnly] = useState(false);
  const [partnersOnly, setPartnersOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch users with filters
  const {
    users,
    total,
    page,
    pages,
    isLoading,
    isError,
    error,
    sendConnectionRequest,
    updateConnectionStatus,
  } = useUserDirectory({
    search: debouncedSearch || undefined,
    role: selectedRole,
    is_order_member: orderMembersOnly ? true : undefined,
    is_partner: partnersOnly ? true : undefined,
    location: locationFilter || undefined,
    page: currentPage,
    limit: 20,
  });

  const hasActiveFilters = selectedRole || orderMembersOnly || partnersOnly || locationFilter;

  const clearFilters = () => {
    setSelectedRole(undefined);
    setOrderMembersOnly(false);
    setPartnersOnly(false);
    setLocationFilter('');
    setCurrentPage(1);
  };

  const handleConnect = async (userId: string) => {
    try {
      // Optimistic update
      updateConnectionStatus(userId, 'pending_sent');

      await sendConnectionRequest.mutateAsync(userId);

      toast({
        title: 'Connection request sent',
        description: 'They will be notified of your request.',
      });
    } catch (err) {
      // Revert on error
      updateConnectionStatus(userId, 'none');
      toast({
        title: 'Failed to send request',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or username..."
            className="pl-10 bg-charcoal-black/50 border-muted-gray/30"
          />
        </div>
        <Button
          onClick={() => setShowFilters(!showFilters)}
          variant="outline"
          className={cn(
            'border-muted-gray/30',
            hasActiveFilters && 'border-accent-yellow text-accent-yellow'
          )}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {hasActiveFilters && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-accent-yellow text-charcoal-black rounded">
              {[selectedRole, orderMembersOnly, partnersOnly, locationFilter].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-bone-white">Filter by</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-accent-yellow flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Role Filter */}
          <div>
            <span className="text-xs text-gray-500 mb-2 block">Role</span>
            <div className="flex flex-wrap gap-2">
              {roleOptions.map((role) => (
                <button
                  key={role.id}
                  onClick={() => {
                    setSelectedRole(selectedRole === role.id ? undefined : role.id);
                    setCurrentPage(1);
                  }}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-full border transition-colors',
                    selectedRole === role.id
                      ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                      : 'border-muted-gray/30 text-gray-500 hover:text-bone-white hover:border-bone-white'
                  )}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>

          {/* Membership Filters */}
          <div>
            <span className="text-xs text-gray-500 mb-2 block">Membership</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setOrderMembersOnly(!orderMembersOnly);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  orderMembersOnly
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-muted-gray/30 text-gray-500 hover:text-bone-white hover:border-bone-white'
                )}
              >
                Order Members
              </button>
              <button
                onClick={() => {
                  setPartnersOnly(!partnersOnly);
                  setCurrentPage(1);
                }}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-colors',
                  partnersOnly
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-muted-gray/30 text-gray-500 hover:text-bone-white hover:border-bone-white'
                )}
              >
                Partners
              </button>
            </div>
          </div>

          {/* Location Filter */}
          <div>
            <span className="text-xs text-gray-500 mb-2 block">Location</span>
            <LocationAutocomplete
              value={locationFilter}
              onChange={(locationData: LocationData) => {
                // In city mode, displayName is already "City, State" format
                setLocationFilter(locationData.displayName);
                setCurrentPage(1);
              }}
              showUseMyLocation={false}
              placeholder="Start typing a city or state..."
              className="max-w-xs"
              mode="city"
            />
          </div>
        </div>
      )}

      {/* Results Count */}
      {!isLoading && total > 0 && (
        <p className="text-sm text-gray-500">
          Showing {users.length} of {total} {total === 1 ? 'member' : 'members'}
        </p>
      )}

      {/* Error State */}
      {isError && (
        <div className="text-center py-8">
          <p className="text-primary-red">
            Failed to load users: {error?.message || 'Unknown error'}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      )}

      {/* User Grid */}
      {!isLoading && users.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {users.map((directoryUser) => (
            <UserCard
              key={directoryUser.id}
              user={directoryUser}
              onConnect={() => handleConnect(directoryUser.id)}
              isConnecting={sendConnectionRequest.isPending}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && users.length === 0 && !isError && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-bone-white mb-2">
            {search ? `No results for "${search}"` : 'No members found'}
          </h3>
          <p className="text-gray-500">
            {search
              ? 'Try adjusting your search terms or filters.'
              : 'When members join the platform, they will appear here.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="border-muted-gray/30"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-500">
            Page {currentPage} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
            disabled={currentPage >= pages}
            className="border-muted-gray/30"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Individual user card with connection actions
 */
interface UserCardProps {
  user: DirectoryUser;
  onConnect: () => void;
  isConnecting: boolean;
}

function UserCard({ user, onConnect, isConnecting }: UserCardProps) {
  const displayName = user.full_name || user.display_name || user.username || 'Anonymous';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
      {/* User Info */}
      <Link to={`/profile/${user.id}`} className="flex items-center gap-3 mb-3">
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="bg-muted-gray/30 text-bone-white">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-bone-white truncate hover:text-accent-yellow transition-colors">
            {displayName}
          </h3>
          {user.role && (
            <p className="text-sm text-gray-500 truncate capitalize">{user.role}</p>
          )}
        </div>
      </Link>

      {/* Location */}
      {user.location && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{user.location}</span>
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mb-3">
        {user.is_order_member && (
          <Badge variant="outline" className="text-xs border-emerald-600 text-emerald-400">
            Order
          </Badge>
        )}
        {user.is_partner && (
          <Badge variant="outline" className="text-xs border-blue-600 text-blue-400">
            Partner
          </Badge>
        )}
      </div>

      {/* Connection Action */}
      <ConnectionButton
        status={user.connection_status}
        userId={user.id}
        onConnect={onConnect}
        isConnecting={isConnecting}
      />
    </div>
  );
}

/**
 * Connection button based on status
 */
interface ConnectionButtonProps {
  status: DirectoryUser['connection_status'];
  userId: string;
  onConnect: () => void;
  isConnecting: boolean;
}

function ConnectionButton({ status, userId, onConnect, isConnecting }: ConnectionButtonProps) {
  switch (status) {
    case 'connected':
      return (
        <div className="flex gap-2">
          <Badge className="flex-1 justify-center py-1.5 bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
            <Check className="w-3 h-3 mr-1" />
            Connected
          </Badge>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="border-muted-gray/30 hover:border-accent-yellow hover:text-accent-yellow"
          >
            <Link to={`/messages?with=${userId}`}>
              <MessageSquare className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      );

    case 'pending_sent':
      return (
        <Badge
          variant="outline"
          className="w-full justify-center py-1.5 border-amber-600/30 text-amber-400 bg-amber-600/10"
        >
          <Clock className="w-3 h-3 mr-1" />
          Request Sent
        </Badge>
      );

    case 'pending_received':
      return (
        <Badge
          variant="outline"
          className="w-full justify-center py-1.5 border-blue-600/30 text-blue-400 bg-blue-600/10"
        >
          <Clock className="w-3 h-3 mr-1" />
          Request Pending
        </Badge>
      );

    default:
      return (
        <Button
          variant="outline"
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full border-muted-gray/30 hover:border-accent-yellow hover:text-accent-yellow"
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-1" />
              Connect
            </>
          )}
        </Button>
      );
  }
}

export default PeopleDirectory;
