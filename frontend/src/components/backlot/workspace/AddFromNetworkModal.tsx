/**
 * AddFromNetworkModal - Modal for adding project members from the network directory
 * Displays users in Community People style with "Add to Project" functionality
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  Plus,
  UserPlus,
  Users,
  Check,
} from 'lucide-react';
import PersonCard from '@/components/shared/PersonCard';
import {
  useDirectorySearch,
  toProfileFormat,
  type DirectoryUser,
} from '@/hooks/useDirectorySearch';
import { BACKLOT_ROLES } from '@/hooks/backlot/useProjectRoles';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface AddFromNetworkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onAddMember: (params: {
    userId: string;
    role: string;
    backlotRole?: string;
  }) => Promise<void>;
}

const AddFromNetworkModal: React.FC<AddFromNetworkModalProps> = ({
  open,
  onOpenChange,
  projectId,
  onAddMember,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<DirectoryUser | null>(null);
  const [selectedRole, setSelectedRole] = useState('viewer');
  const [selectedBacklotRole, setSelectedBacklotRole] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addedUserIds, setAddedUserIds] = useState<Set<string>>(new Set());

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setDebouncedQuery('');
      setSelectedUser(null);
      setSelectedRole('viewer');
      setSelectedBacklotRole('');
      setAddedUserIds(new Set());
    }
  }, [open]);

  // Directory search with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useDirectorySearch({
    q: debouncedQuery,
    excludeProjectId: projectId,
    limit: 20,
  });

  // Setup infinite scroll observer
  useEffect(() => {
    if (!open) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [open, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allUsers = data?.pages.flatMap((page) => page.users) || [];
  const totalCount = data?.pages[0]?.total || 0;

  const handleSelectUser = (user: DirectoryUser) => {
    setSelectedUser(user);
  };

  const handleAddMember = async () => {
    if (!selectedUser) return;

    setIsAdding(true);
    try {
      await onAddMember({
        userId: selectedUser.profile_id,
        role: selectedRole,
        backlotRole: selectedBacklotRole || undefined,
      });

      // Mark user as added
      setAddedUserIds((prev) => new Set([...prev, selectedUser.profile_id]));

      toast.success(
        `${selectedUser.full_name || selectedUser.username} added to project`
      );

      // Reset selection but stay in modal for more additions
      setSelectedUser(null);
      setSelectedRole('viewer');
      setSelectedBacklotRole('');
    } catch (err) {
      toast.error('Failed to add team member');
    } finally {
      setIsAdding(false);
    }
  };

  const handleQuickAdd = async (user: DirectoryUser) => {
    setIsAdding(true);
    try {
      await onAddMember({
        userId: user.profile_id,
        role: 'viewer',
      });

      setAddedUserIds((prev) => new Set([...prev, user.profile_id]));

      toast.success(
        `${user.full_name || user.username} added to project as viewer`
      );
    } catch (err) {
      toast.error('Failed to add team member');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-deep-gray border-muted-gray/30">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <UserPlus className="h-5 w-5" />
            Add from Network
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Search the community directory to find people to add to your project.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="flex-shrink-0 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
          />
        </div>

        {/* Selected User Panel */}
        {selectedUser && (
          <div className="flex-shrink-0 bg-charcoal-black/50 border border-accent-yellow/30 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <PersonCard
                profile={toProfileFormat(selectedUser)}
                variant="compact"
                showProfileLink={false}
                className="flex-1 border-0 bg-transparent p-0"
              />
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="w-[120px] bg-charcoal-black border-muted-gray/30 text-bone-white">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedBacklotRole}
                    onValueChange={setSelectedBacklotRole}
                  >
                    <SelectTrigger className="w-[140px] bg-charcoal-black border-muted-gray/30 text-bone-white">
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      {BACKLOT_ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleAddMember}
                    disabled={isAdding}
                    className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-4 w-4 mr-1" />
                    )}
                    Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results Grid */}
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-48 bg-charcoal-black/50" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-12 text-muted-gray">
              <p>Failed to load directory. Please try again.</p>
            </div>
          ) : allUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-gray">
              <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">No results found</p>
              {debouncedQuery ? (
                <p className="text-sm">
                  Try a different search term or clear the search to see all
                  members.
                </p>
              ) : (
                <p className="text-sm">
                  No community members available to add to this project.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-gray mb-4">
                {totalCount} member{totalCount !== 1 ? 's' : ''} found
                {debouncedQuery && ` for "${debouncedQuery}"`}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {allUsers.map((user) => {
                  const isAdded = addedUserIds.has(user.profile_id);
                  const isSelected =
                    selectedUser?.profile_id === user.profile_id;

                  return (
                    <PersonCard
                      key={user.profile_id}
                      profile={toProfileFormat(user)}
                      variant="default"
                      showProfileLink={true}
                      className={cn(
                        'transition-all',
                        isSelected && 'ring-2 ring-accent-yellow',
                        isAdded && 'opacity-60'
                      )}
                      actions={
                        isAdded ? (
                          <Button
                            disabled
                            className="w-full bg-forest-600/50 text-bone-white"
                          >
                            <Check className="h-4 w-4 mr-2" />
                            Added
                          </Button>
                        ) : (
                          <>
                            <Button
                              onClick={() => handleSelectUser(user)}
                              variant="outline"
                              className="w-full border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black"
                            >
                              Select & Configure
                            </Button>
                            <Button
                              onClick={() => handleQuickAdd(user)}
                              disabled={isAdding}
                              className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                            >
                              {isAdding ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Plus className="h-4 w-4 mr-2" />
                              )}
                              Quick Add as Viewer
                            </Button>
                          </>
                        )
                      }
                    />
                  );
                })}
              </div>

              {/* Infinite scroll trigger */}
              <div ref={loadMoreRef} className="h-10 flex items-center justify-center">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-2 text-muted-gray">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading more...</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex justify-end pt-4 border-t border-muted-gray/20">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFromNetworkModal;
