/**
 * MyJobPosts - Manage your community job postings and view applications
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useCollabs } from '@/hooks/useCollabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import CollabForm from '@/components/community/CollabForm';
import CollabApplicationsView from '@/components/applications/CollabApplicationsView';
import { QuickAddGearDialog } from '@/components/gear/lite/QuickAddGearDialog';
import { QuickAddSpaceDialog } from '@/components/gear/lite/QuickAddSpaceDialog';
import { useMyGearListings } from '@/hooks/gear/usePersonalGear';
import { useMySpaceListings } from '@/hooks/set-house/usePersonalSetHouse';
import type { SpaceMarketplaceListing } from '@/hooks/set-house/usePersonalSetHouse';
import type { PersonalGearAsset, GearMarketplaceListing } from '@/types/gear';
import {
  FileText,
  CheckCircle,
  Users,
  UserCheck,
  Plus,
  Search,
  ArrowLeft,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  MoreVertical,
  MapPin,
  Wifi,
  Briefcase,
  ExternalLink,
  Package,
  Tag,
  DollarSign,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CommunityCollab, CollabType } from '@/types/community';
import { format } from 'date-fns';

// -- Type labels & badges --
const TYPE_LABELS: Record<CollabType, string> = {
  looking_for_crew: 'Crew',
  looking_for_cast: 'Cast',
  available_for_hire: 'Available',
  partner_opportunity: 'Partner',
};

const TYPE_COLORS: Record<CollabType, string> = {
  looking_for_crew: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  looking_for_cast: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  available_for_hire: 'bg-green-500/20 text-green-400 border-green-500/30',
  partner_opportunity: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const COMP_LABELS: Record<string, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  deferred: 'Deferred',
  negotiable: 'Negotiable',
};

const COMP_COLORS: Record<string, string> = {
  paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  unpaid: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  deferred: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  negotiable: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

type ActiveView = 'list' | 'applications';
type StatusFilter = 'all' | 'active' | 'inactive';
type TypeFilter = CollabType | 'all';
type PageTab = 'job-posts' | 'gear-listings' | 'space-listings';
type GearSubTab = 'for-rent' | 'for-sale';

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'looking_for_crew', label: 'Crew' },
  { value: 'looking_for_cast', label: 'Cast' },
  { value: 'available_for_hire', label: 'Available' },
  { value: 'partner_opportunity', label: 'Partner' },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const API_BASE = import.meta.env.VITE_API_URL || '';

const MyJobPosts = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profileId, session } = useAuth();
  const queryClient = useQueryClient();

  // State — read initial tab from query param
  const initialTab = (searchParams.get('tab') as PageTab) || 'job-posts';
  const [pageTab, setPageTab] = useState<PageTab>(initialTab);
  const [gearSubTab, setGearSubTab] = useState<GearSubTab>('for-rent');
  const [activeView, setActiveView] = useState<ActiveView>('list');
  const [selectedCollab, setSelectedCollab] = useState<CommunityCollab | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCollab, setEditingCollab] = useState<CommunityCollab | undefined>();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Gear listings state
  const [showGearDialog, setShowGearDialog] = useState(false);
  const [editingGearAsset, setEditingGearAsset] = useState<PersonalGearAsset | null>(null);

  // Space listings state
  const [showSpaceDialog, setShowSpaceDialog] = useState(false);

  // Data
  const { collabs, isLoading, deleteCollab, deactivateCollab } = useCollabs({
    userId: profileId || undefined,
    limit: 200,
  });

  // Single endpoint covers personal gear org + all Gear House orgs
  const { data: myGearData, isLoading: isGearTabLoading } = useMyGearListings();
  const gearListings: GearMarketplaceListing[] = myGearData?.listings || [];
  const personalOrgId = myGearData?.personal_org_id || null;

  // Single endpoint covers personal set house org + all Set House orgs
  const { data: mySpaceData, isLoading: isSpaceTabLoading } = useMySpaceListings();
  const spaceListings: SpaceMarketplaceListing[] = mySpaceData?.listings || [];
  const personalSpaceOrgId = mySpaceData?.personal_org_id || null;

  const refetchSpaceAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['my-space-listings'] });
  }, [queryClient]);

  const isPersonalListing = useCallback(
    (listing: GearMarketplaceListing) => listing.organization_id === personalOrgId,
    [personalOrgId]
  );

  const refetchGearAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['my-gear-listings'] });
  }, [queryClient]);

  // Filtered collabs
  const filteredCollabs = useMemo(() => {
    let result = collabs;

    if (typeFilter !== 'all') {
      result = result.filter((c) => c.type === typeFilter);
    }
    if (statusFilter === 'active') {
      result = result.filter((c) => c.is_active);
    } else if (statusFilter === 'inactive') {
      result = result.filter((c) => !c.is_active);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.production_title?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [collabs, typeFilter, statusFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: collabs.length,
    active: collabs.filter((c) => c.is_active).length,
    applications: collabs.reduce((sum, c) => sum + (c.application_count || 0), 0),
    booked: 0, // Would require checking application statuses per collab
  }), [collabs]);

  // Handlers
  const handleViewApplications = (collab: CommunityCollab) => {
    setSelectedCollab(collab);
    setActiveView('applications');
  };

  const handleBackToList = () => {
    setSelectedCollab(null);
    setActiveView('list');
  };

  const handleEdit = (collab: CommunityCollab) => {
    setEditingCollab(collab);
    setShowCreateForm(true);
  };

  const handleDelete = async (collab: CommunityCollab) => {
    if (!confirm(`Delete "${collab.title}"? This cannot be undone.`)) return;
    try {
      await deleteCollab.mutateAsync(collab.id);
      toast.success('Post deleted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete post');
    }
  };

  const handleDeactivate = async (collab: CommunityCollab) => {
    try {
      await deactivateCollab.mutateAsync(collab.id);
      toast.success(collab.is_active ? 'Post deactivated' : 'Post reactivated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update post');
    }
  };

  const handleFormClose = () => {
    setShowCreateForm(false);
    setEditingCollab(undefined);
  };

  const handleToggleGear = async (listing: GearMarketplaceListing) => {
    try {
      let res: Response;
      if (isPersonalListing(listing)) {
        res = await fetch(
          `${API_BASE}/api/v1/gear/personal/assets/${listing.asset_id}/toggle-listing`,
          { method: 'POST', headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
      } else {
        res = await fetch(
          `${API_BASE}/api/v1/gear/marketplace/${listing.organization_id}/listings/${listing.id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ is_listed: !listing.is_listed }),
          }
        );
      }
      if (!res.ok) throw new Error('Failed to update listing');
      toast.success(listing.is_listed ? 'Removed from community' : 'Listed in community');
      refetchGearAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update listing');
    }
  };

  const handleDeleteGear = async (listing: GearMarketplaceListing) => {
    const name = listing.asset?.name || 'this item';
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      let res: Response;
      if (isPersonalListing(listing)) {
        res = await fetch(
          `${API_BASE}/api/v1/gear/personal/assets/${listing.asset_id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
      } else {
        res = await fetch(
          `${API_BASE}/api/v1/gear/marketplace/${listing.organization_id}/listings/${listing.id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } }
        );
      }
      if (!res.ok) throw new Error('Failed to delete listing');
      toast.success('Listing deleted');
      refetchGearAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete listing');
    }
  };

  // Map a marketplace listing to PersonalGearAsset shape for QuickAddGearDialog
  const listingToEditAsset = (listing: GearMarketplaceListing): PersonalGearAsset => ({
    id: listing.asset_id,
    name: listing.asset?.name || '',
    make: listing.asset?.make,
    manufacturer: listing.asset?.make,
    model: listing.asset?.model,
    category_id: listing.asset?.category_id,
    photos_current: listing.asset?.photos_current,
    listing_id: listing.id,
    is_listed: listing.is_listed,
    listing_type: listing.listing_type,
    daily_rate: listing.daily_rate,
    weekly_rate: listing.weekly_rate,
    monthly_rate: listing.monthly_rate,
    sale_price: listing.sale_price,
    sale_condition: listing.sale_condition,
    sale_includes: listing.sale_includes,
    deposit_amount: listing.deposit_amount,
    insurance_required: listing.insurance_required,
    min_rental_days: listing.min_rental_days,
  });

  // Applications view
  if (activeView === 'applications' && selectedCollab) {
    return (
      <div className="container mx-auto px-4 max-w-7xl py-8">
        <CollabApplicationsView collab={selectedCollab} onBack={handleBackToList} />
      </div>
    );
  }

  // List view
  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/filmmakers?tab=collabs')}
            className="text-muted-gray hover:text-bone-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading text-3xl text-bone-white uppercase tracking-wide">
              My Posts
            </h1>
            <p className="text-muted-gray text-sm mt-1">
              Manage your job posts, gear listings, space listings, and applications
            </p>
          </div>
        </div>
        {pageTab === 'job-posts' ? (
          <Button
            onClick={() => {
              setEditingCollab(undefined);
              setShowCreateForm(true);
            }}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Post a Job
          </Button>
        ) : pageTab === 'gear-listings' ? (
          <Button
            onClick={() => {
              setEditingGearAsset(null);
              setShowGearDialog(true);
            }}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            List Gear
          </Button>
        ) : (
          <Button
            onClick={() => setShowSpaceDialog(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 font-medium"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Space
          </Button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 mb-8 bg-white/5 rounded-lg p-0.5 w-fit">
        <button
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium transition-colors',
            pageTab === 'job-posts' ? 'bg-white/15 text-bone-white' : 'text-muted-gray hover:text-bone-white'
          )}
          onClick={() => setPageTab('job-posts')}
        >
          Job Posts
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            pageTab === 'gear-listings' ? 'bg-white/15 text-bone-white' : 'text-muted-gray hover:text-bone-white'
          )}
          onClick={() => setPageTab('gear-listings')}
        >
          <Package className="w-3.5 h-3.5" />
          Gear Listings
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
            pageTab === 'space-listings' ? 'bg-white/15 text-bone-white' : 'text-muted-gray hover:text-bone-white'
          )}
          onClick={() => setPageTab('space-listings')}
        >
          <Building2 className="w-3.5 h-3.5" />
          Space Listings
        </button>
      </div>

      {pageTab === 'job-posts' && (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard icon={FileText} label="Total Posts" value={stats.total} color="text-bone-white" />
            <StatCard icon={CheckCircle} label="Active" value={stats.active} color="text-green-400" />
            <StatCard icon={Users} label="Applications" value={stats.applications} color="text-accent-yellow" />
            <StatCard icon={UserCheck} label="Booked" value={stats.booked} color="text-blue-400" />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            {/* Type filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {TYPE_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTypeFilter(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                    typeFilter === opt.value
                      ? 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40'
                      : 'bg-charcoal-black text-muted-gray border-muted-gray/30 hover:text-bone-white hover:border-muted-gray/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Status filter pills */}
            <div className="flex gap-1.5">
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                    statusFilter === opt.value
                      ? 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/40'
                      : 'bg-charcoal-black text-muted-gray border-muted-gray/30 hover:text-bone-white hover:border-muted-gray/50'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray/60"
              />
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-48 bg-muted-gray/10 rounded-lg" />
              ))}
            </div>
          ) : filteredCollabs.length === 0 ? (
            <EmptyState
              hasCollabs={collabs.length > 0}
              onCreatePost={() => {
                setEditingCollab(undefined);
                setShowCreateForm(true);
              }}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCollabs.map((collab) => (
                <PostCard
                  key={collab.id}
                  collab={collab}
                  onViewApplications={() => handleViewApplications(collab)}
                  onEdit={() => handleEdit(collab)}
                  onDeactivate={() => handleDeactivate(collab)}
                  onDelete={() => handleDelete(collab)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {pageTab === 'gear-listings' && (
        isGearTabLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 bg-muted-gray/10 rounded-lg" />
            ))}
          </div>
        ) : (
          <>
            {/* For Rent / For Sale sub-tab toggle */}
            <div className="flex gap-1 mb-6 bg-white/5 rounded-lg p-0.5 w-fit">
              <button
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  gearSubTab === 'for-rent'
                    ? 'bg-white/15 text-bone-white'
                    : 'text-muted-gray hover:text-bone-white'
                )}
                onClick={() => setGearSubTab('for-rent')}
              >
                For Rent
              </button>
              <button
                className={cn(
                  'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                  gearSubTab === 'for-sale'
                    ? 'bg-white/15 text-bone-white'
                    : 'text-muted-gray hover:text-bone-white'
                )}
                onClick={() => setGearSubTab('for-sale')}
              >
                For Sale
              </button>
            </div>

            {(() => {
              const filtered = gearListings.filter((l) => {
                const t = l.listing_type || 'rent';
                if (gearSubTab === 'for-rent') return t === 'rent' || t === 'both';
                return t === 'sale' || t === 'both';
              });

              if (filtered.length === 0) {
                return (
                  <GearEmptyState
                    onList={() => { setEditingGearAsset(null); setShowGearDialog(true); }}
                  />
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filtered.map((listing) => (
                    <GearListingCard
                      key={listing.id}
                      listing={listing}
                      onEdit={() => { setEditingGearAsset(listingToEditAsset(listing)); setShowGearDialog(true); }}
                      onToggle={() => handleToggleGear(listing)}
                      onDelete={() => handleDeleteGear(listing)}
                    />
                  ))}
                </div>
              );
            })()}
          </>
        )
      )}

      {pageTab === 'space-listings' && (
        isSpaceTabLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 bg-muted-gray/10 rounded-lg" />
            ))}
          </div>
        ) : spaceListings.length === 0 ? (
          <SpaceEmptyState onAdd={() => setShowSpaceDialog(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {spaceListings.map((listing) => (
              <SpaceListingCard
                key={listing.id}
                listing={listing}
              />
            ))}
          </div>
        )
      )}

      {/* Create/Edit Form Dialog */}
      <Dialog open={showCreateForm} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0"
          ariaLabel={editingCollab ? 'Edit job post' : 'Create job post'}
        >
          <DialogTitle className="sr-only">
            {editingCollab ? 'Edit Job Post' : 'Create Job Post'}
          </DialogTitle>
          <CollabForm
            onClose={handleFormClose}
            editCollab={editingCollab}
          />
        </DialogContent>
      </Dialog>

      {/* Gear Listing Dialog */}
      <QuickAddGearDialog
        open={showGearDialog}
        onClose={() => { setShowGearDialog(false); setEditingGearAsset(null); }}
        onSuccess={() => { setShowGearDialog(false); setEditingGearAsset(null); refetchGearAll(); }}
        editAsset={editingGearAsset}
      />

      {/* Space Listing Dialog */}
      <QuickAddSpaceDialog
        open={showSpaceDialog}
        onClose={() => setShowSpaceDialog(false)}
        onSuccess={() => { setShowSpaceDialog(false); refetchSpaceAll(); }}
      />
    </div>
  );
};

// -- Sub-components --

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="bg-charcoal-black border-muted-gray/20 p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg bg-muted-gray/10', color)}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-heading font-bold text-bone-white">{value}</p>
          <p className="text-xs text-muted-gray">{label}</p>
        </div>
      </div>
    </Card>
  );
}

function PostCard({
  collab,
  onViewApplications,
  onEdit,
  onDeactivate,
  onDelete,
}: {
  collab: CommunityCollab;
  onViewApplications: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const appCount = collab.application_count || 0;

  return (
    <Card className="bg-charcoal-black border-muted-gray/20 p-5 hover:border-muted-gray/40 transition-colors">
      {/* Badges row */}
      <div className="flex flex-wrap gap-2 mb-3">
        <Badge variant="outline" className={cn('text-xs', TYPE_COLORS[collab.type])}>
          {TYPE_LABELS[collab.type]}
        </Badge>
        {collab.compensation_type && (
          <Badge variant="outline" className={cn('text-xs', COMP_COLORS[collab.compensation_type] || '')}>
            {COMP_LABELS[collab.compensation_type] || collab.compensation_type}
          </Badge>
        )}
        {collab.is_remote && (
          <Badge variant="outline" className="text-xs bg-teal-500/20 text-teal-400 border-teal-500/30">
            <Wifi className="w-3 h-3 mr-1" />
            Remote
          </Badge>
        )}
        {collab.location && !collab.is_remote && (
          <Badge variant="outline" className="text-xs bg-muted-gray/20 text-muted-gray border-muted-gray/30">
            <MapPin className="w-3 h-3 mr-1" />
            {collab.location}
          </Badge>
        )}
        {!collab.is_active && (
          <Badge variant="outline" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
            Inactive
          </Badge>
        )}
        {collab.backlot_project_id && (
          <Badge variant="outline" className="text-xs bg-accent-yellow/10 text-accent-yellow/70 border-accent-yellow/20">
            <Briefcase className="w-3 h-3 mr-1" />
            Backlot
          </Badge>
        )}
      </div>

      {/* Title */}
      <h3 className="text-lg font-heading font-semibold text-bone-white mb-2 line-clamp-1">
        {collab.title}
      </h3>

      {/* Meta */}
      <p className="text-sm text-muted-gray mb-4">
        {appCount > 0 && (
          <span className="text-accent-yellow">{appCount} application{appCount !== 1 ? 's' : ''}</span>
        )}
        {appCount > 0 && collab.created_at && ' · '}
        {collab.created_at && (
          <span>Posted {format(new Date(collab.created_at), 'MMM d, yyyy')}</span>
        )}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-muted-gray/20">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewApplications}
          className="text-xs border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
        >
          <Users className="w-3.5 h-3.5 mr-1.5" />
          Applications{appCount > 0 ? ` (${appCount})` : ''}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="text-xs border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Edit
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-gray hover:text-bone-white ml-auto"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-charcoal-black border-muted-gray/30"
          >
            <DropdownMenuItem
              onClick={onDeactivate}
              className="text-bone-white hover:bg-muted-gray/10 cursor-pointer"
            >
              {collab.is_active ? (
                <>
                  <PowerOff className="w-4 h-4 mr-2 text-yellow-400" />
                  Deactivate
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 mr-2 text-green-400" />
                  Reactivate
                </>
              )}
            </DropdownMenuItem>
            {collab.backlot_project_id && (
              <DropdownMenuItem
                onClick={() => window.open(`/backlot/projects/${collab.backlot_project_id}`, '_blank')}
                className="text-bone-white hover:bg-muted-gray/10 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 mr-2 text-accent-yellow" />
                Open in Backlot
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-400 hover:bg-red-500/10 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function EmptyState({
  hasCollabs,
  onCreatePost,
}: {
  hasCollabs: boolean;
  onCreatePost: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted-gray/10 mb-4">
        <FileText className="w-10 h-10 text-muted-gray" />
      </div>
      <h3 className="text-lg font-heading text-bone-white mb-2">
        {hasCollabs ? 'No posts match your filters' : 'No job posts yet'}
      </h3>
      <p className="text-muted-gray text-sm mb-6 max-w-md">
        {hasCollabs
          ? 'Try adjusting your filters or search query.'
          : 'Create your first job post to find crew, cast, or partners for your project.'}
      </p>
      {!hasCollabs && (
        <Button
          onClick={onCreatePost}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Your First Post
        </Button>
      )}
    </div>
  );
}

const LISTING_TYPE_LABELS: Record<string, string> = {
  rent: 'For Rent',
  sale: 'For Sale',
  both: 'Rent & Sale',
};

const LISTING_TYPE_COLORS: Record<string, string> = {
  rent: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  sale: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  both: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function GearListingCard({
  listing,
  onEdit,
  onToggle,
  onDelete,
}: {
  listing: GearMarketplaceListing;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const thumbnail = listing.asset?.photos_current?.[0];
  const listingType = listing.listing_type || 'rent';
  const assetName = listing.asset?.name || 'Unnamed Item';
  const makeModel = [listing.asset?.make, listing.asset?.model].filter(Boolean).join(' ');

  return (
    <Card className="bg-charcoal-black border-muted-gray/20 p-5 hover:border-muted-gray/40 transition-colors">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg bg-muted-gray/10 flex-shrink-0 overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt={assetName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-8 h-8 text-muted-gray/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Badge variant="outline" className={cn('text-xs', LISTING_TYPE_COLORS[listingType] || '')}>
              <Tag className="w-3 h-3 mr-1" />
              {LISTING_TYPE_LABELS[listingType] || listingType}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                listing.is_listed
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-muted-gray/20 text-muted-gray border-muted-gray/30'
              )}
            >
              {listing.is_listed ? 'Listed' : 'Unlisted'}
            </Badge>
          </div>

          {/* Name */}
          <h3 className="text-base font-heading font-semibold text-bone-white line-clamp-1 mb-1">
            {assetName}
          </h3>

          {/* Make / Model */}
          {makeModel && (
            <p className="text-xs text-muted-gray mb-2 line-clamp-1">{makeModel}</p>
          )}

          {/* Pricing */}
          <div className="flex items-center gap-3 text-xs text-muted-gray">
            {listing.daily_rate != null && (
              <span className="flex items-center gap-0.5 text-accent-yellow font-medium">
                <DollarSign className="w-3 h-3" />
                {listing.daily_rate}/day
              </span>
            )}
            {listing.sale_price != null && (
              <span className="flex items-center gap-0.5 text-emerald-400 font-medium">
                <DollarSign className="w-3 h-3" />
                {listing.sale_price} sale
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 mt-3 border-t border-muted-gray/20">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          className="text-xs border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
        >
          <Pencil className="w-3.5 h-3.5 mr-1.5" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggle}
          className="text-xs border-muted-gray/30 text-bone-white hover:bg-muted-gray/10"
        >
          {listing.is_listed ? (
            <><PowerOff className="w-3.5 h-3.5 mr-1.5 text-yellow-400" />Unlist</>
          ) : (
            <><Power className="w-3.5 h-3.5 mr-1.5 text-green-400" />List</>
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-gray hover:text-bone-white ml-auto"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-charcoal-black border-muted-gray/30">
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-400 hover:bg-red-500/10 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}

function GearEmptyState({ onList }: { onList: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted-gray/10 mb-4">
        <Package className="w-10 h-10 text-muted-gray" />
      </div>
      <h3 className="text-lg font-heading text-bone-white mb-2">No gear listings yet</h3>
      <p className="text-muted-gray text-sm mb-6 max-w-md">
        List your equipment on the community marketplace to rent or sell to fellow filmmakers.
      </p>
      <Button
        onClick={onList}
        className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
      >
        <Plus className="w-4 h-4 mr-2" />
        List Your First Item
      </Button>
    </div>
  );
}

function SpaceEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="p-4 rounded-full bg-muted-gray/10 mb-4">
        <Building2 className="w-10 h-10 text-muted-gray" />
      </div>
      <h3 className="text-lg font-heading text-bone-white mb-2">No space listings yet</h3>
      <p className="text-muted-gray text-sm mb-6 max-w-md">
        List your studio, location, or production space on the community marketplace.
      </p>
      <Button
        onClick={onAdd}
        className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Your First Space
      </Button>
    </div>
  );
}

function SpaceListingCard({ listing }: { listing: SpaceMarketplaceListing }) {
  const thumbnail = listing.space?.photos?.[0];
  const spaceName = listing.space?.name || 'Unnamed Space';
  const spaceType = listing.space?.space_type;

  const SPACE_TYPE_LABELS: Record<string, string> = {
    studio: 'Studio',
    sound_stage: 'Sound Stage',
    location: 'Location',
    backlot: 'Backlot',
    green_screen: 'Green Screen',
    office: 'Office',
    warehouse: 'Warehouse',
    outdoor: 'Outdoor',
    residential: 'Residential',
    other: 'Other',
  };

  return (
    <Card className="bg-charcoal-black border-muted-gray/20 p-5 hover:border-muted-gray/40 transition-colors">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 rounded-lg bg-muted-gray/10 flex-shrink-0 overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt={spaceName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-8 h-8 text-muted-gray/40" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {spaceType && (
              <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
                {SPACE_TYPE_LABELS[spaceType] || spaceType}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                listing.is_listed
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-muted-gray/20 text-muted-gray border-muted-gray/30'
              )}
            >
              {listing.is_listed ? 'Listed' : 'Unlisted'}
            </Badge>
          </div>

          {/* Name */}
          <h3 className="text-base font-heading font-semibold text-bone-white line-clamp-1 mb-1">
            {spaceName}
          </h3>

          {/* Square footage */}
          {listing.space?.square_footage && (
            <p className="text-xs text-muted-gray mb-2">
              {listing.space.square_footage.toLocaleString()} sq ft
            </p>
          )}

          {/* Pricing */}
          <div className="flex items-center gap-3 text-xs text-muted-gray">
            {listing.daily_rate != null && (
              <span className="flex items-center gap-0.5 text-accent-yellow font-medium">
                <DollarSign className="w-3 h-3" />
                {listing.daily_rate}/day
              </span>
            )}
            {listing.hourly_rate != null && (
              <span className="flex items-center gap-0.5 text-muted-gray">
                <DollarSign className="w-3 h-3" />
                {listing.hourly_rate}/hr
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default MyJobPosts;
