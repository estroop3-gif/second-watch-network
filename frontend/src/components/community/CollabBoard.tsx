/**
 * CollabBoard - Collaboration posts board with filtering
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCollabs } from '@/hooks/useCollabs';
import { useAuth } from '@/context/AuthContext';
import CollabCard from './CollabCard';
import { ApplicationModal, CollabApplicationsView } from '@/components/applications';
import { CollabType, CompensationType, CommunityCollab } from '@/types/community';
import {
  Plus,
  Briefcase,
  Users,
  Building2,
  Filter,
  Globe,
  MapPin,
  DollarSign,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollabBoardProps {
  onCreateCollab?: () => void;
  onViewCollab?: (collab: CommunityCollab) => void;
}

const collabTypes = [
  { id: 'all' as const, label: 'All', icon: Filter },
  { id: 'looking_for_crew' as const, label: 'Looking for Crew', icon: Users, color: 'text-blue-400' },
  { id: 'available_for_hire' as const, label: 'Available for Hire', icon: Briefcase, color: 'text-green-400' },
  { id: 'partner_opportunity' as const, label: 'Partner Opportunity', icon: Building2, color: 'text-purple-400' },
];

const compensationTypes = [
  { id: 'all' as const, label: 'Any Pay' },
  { id: 'paid' as const, label: 'Paid' },
  { id: 'unpaid' as const, label: 'Unpaid' },
  { id: 'deferred' as const, label: 'Deferred' },
  { id: 'negotiable' as const, label: 'Negotiable' },
];

const CollabBoard: React.FC<CollabBoardProps> = ({ onCreateCollab, onViewCollab }) => {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState<CollabType | 'all'>('all');
  const [remoteFilter, setRemoteFilter] = useState<boolean | null>(null);
  const [compensationFilter, setCompensationFilter] = useState<CompensationType | 'all'>('all');
  const [orderOnly, setOrderOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Application modal state
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [selectedCollab, setSelectedCollab] = useState<CommunityCollab | null>(null);

  // Applications view state (for owners viewing their collab's applications)
  const [viewingApplicationsCollab, setViewingApplicationsCollab] = useState<CommunityCollab | null>(null);

  const { collabs, isLoading, error, refetch } = useCollabs({
    type: typeFilter,
    isRemote: remoteFilter,
    compensationType: compensationFilter,
    orderOnly,
  });

  const handleApply = (collab: CommunityCollab) => {
    setSelectedCollab(collab);
    setApplicationModalOpen(true);
  };

  const handleApplicationSuccess = () => {
    refetch();
  };

  const handleViewApplications = (collab: CommunityCollab) => {
    setViewingApplicationsCollab(collab);
  };

  const handleBackFromApplications = () => {
    setViewingApplicationsCollab(null);
  };

  const handleViewDetails = (collab: CommunityCollab) => {
    if (onViewCollab) {
      onViewCollab(collab);
    }
  };

  const clearFilters = () => {
    setTypeFilter('all');
    setRemoteFilter(null);
    setCompensationFilter('all');
    setOrderOnly(false);
  };

  const hasActiveFilters = typeFilter !== 'all' || remoteFilter !== null || compensationFilter !== 'all' || orderOnly;

  // If viewing applications for a specific collab, show that view
  if (viewingApplicationsCollab) {
    return (
      <CollabApplicationsView
        collab={viewingApplicationsCollab}
        onBack={handleBackFromApplications}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Collaboration Board</h2>
          <p className="text-muted-gray text-sm">Find work, hire talent, or partner with brands</p>
        </div>
        <Button
          onClick={onCreateCollab}
          className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Post a Collab
        </Button>
      </div>

      {/* Type Filters */}
      <div className="flex flex-wrap gap-2">
        {collabTypes.map((type) => (
          <button
            key={type.id}
            onClick={() => setTypeFilter(type.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-full text-sm border transition-colors',
              typeFilter === type.id
                ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                : 'border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-bone-white'
            )}
          >
            <type.icon className={cn('w-4 h-4', type.color)} />
            {type.label}
          </button>
        ))}
      </div>

      {/* Additional Filters Toggle */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            'border-muted-gray/30',
            hasActiveFilters && 'border-accent-yellow text-accent-yellow'
          )}
        >
          <Filter className="w-4 h-4 mr-2" />
          More Filters
          {hasActiveFilters && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-accent-yellow text-charcoal-black rounded">
              Active
            </span>
          )}
        </Button>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-muted-gray hover:text-accent-yellow flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear all
          </button>
        )}
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 space-y-4">
          {/* Location Type */}
          <div>
            <span className="text-xs text-muted-gray mb-2 block">Location</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setRemoteFilter(null)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors',
                  remoteFilter === null
                    ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                    : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                )}
              >
                Any
              </button>
              <button
                onClick={() => setRemoteFilter(true)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors',
                  remoteFilter === true
                    ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                    : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                )}
              >
                <Globe className="w-3 h-3" />
                Remote
              </button>
              <button
                onClick={() => setRemoteFilter(false)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors',
                  remoteFilter === false
                    ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                    : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                )}
              >
                <MapPin className="w-3 h-3" />
                On-site
              </button>
            </div>
          </div>

          {/* Compensation */}
          <div>
            <span className="text-xs text-muted-gray mb-2 block">Compensation</span>
            <div className="flex flex-wrap gap-2">
              {compensationTypes.map((comp) => (
                <button
                  key={comp.id}
                  onClick={() => setCompensationFilter(comp.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors',
                    compensationFilter === comp.id
                      ? 'bg-accent-yellow text-charcoal-black border-accent-yellow'
                      : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
                  )}
                >
                  {comp.id !== 'all' && <DollarSign className="w-3 h-3" />}
                  {comp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Order Only */}
          <div>
            <span className="text-xs text-muted-gray mb-2 block">Community</span>
            <button
              onClick={() => setOrderOnly(!orderOnly)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded-full border transition-colors',
                orderOnly
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-muted-gray/30 text-muted-gray hover:text-bone-white'
              )}
            >
              Order members only
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 text-center">
          <p className="text-red-400">Failed to load collabs: {error.message}</p>
        </div>
      )}

      {/* Collabs Grid */}
      {!isLoading && !error && collabs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {collabs.map((collab) => (
            <CollabCard
              key={collab.id}
              collab={collab}
              onViewDetails={handleViewDetails}
              onApply={handleApply}
              onViewApplications={handleViewApplications}
              isOwnCollab={collab.user_id === user?.id}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && collabs.length === 0 && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-12 text-center">
          <Users className="w-12 h-12 text-muted-gray mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">
            {hasActiveFilters ? 'No collabs match your filters' : 'No collabs yet'}
          </h3>
          <p className="text-muted-gray mb-6">
            {hasActiveFilters
              ? 'Try adjusting your filters or check back later.'
              : 'Be the first to post a collaboration opportunity!'
            }
          </p>
          {hasActiveFilters ? (
            <Button
              onClick={clearFilters}
              variant="outline"
              className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black"
            >
              Clear Filters
            </Button>
          ) : (
            <Button
              onClick={onCreateCollab}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Collab
            </Button>
          )}
        </div>
      )}

      {/* Application Modal */}
      <ApplicationModal
        isOpen={applicationModalOpen}
        onClose={() => {
          setApplicationModalOpen(false);
          setSelectedCollab(null);
        }}
        collab={selectedCollab}
        onSuccess={handleApplicationSuccess}
      />
    </div>
  );
};

export default CollabBoard;
