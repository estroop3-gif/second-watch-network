/**
 * LocationsView - Manage shooting locations with global library integration
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  MapPin,
  Plus,
  Phone,
  Mail,
  Plug,
  FileCheck,
  DollarSign,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  ExternalLink,
  Search,
  Globe,
  Link2,
  Unlink,
  Building2,
  Camera,
  ImageIcon,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useProjectLocations,
  useGlobalLocationSearch,
  useLocationRegions,
  useLocationTypes,
  useClearances,
  locationHasSignedRelease,
} from '@/hooks/backlot';
import { useTaskLists, useCreateTaskFromSource } from '@/hooks/backlot/useTaskLists';
import {
  BacklotLocation,
  BacklotLocationInput,
  BacklotClearanceStatus,
  CLEARANCE_STATUS_LABELS,
} from '@/types/backlot';
import { LocationDetailModal } from './LocationDetailModal';
import { CreateLocationModal } from './CreateLocationModal';
import { toast } from 'sonner';

interface LocationsViewProps {
  projectId: string;
  canEdit: boolean;
}

const LocationCard: React.FC<{
  location: BacklotLocation;
  canEdit: boolean;
  onEdit: (location: BacklotLocation) => void;
  onDetach: (id: string) => void;
  onView: (location: BacklotLocation) => void;
  onCreateTask?: (location: BacklotLocation) => void;
  isAttached?: boolean;
  releaseStatus?: BacklotClearanceStatus | 'missing' | null;
}> = ({ location, canEdit, onEdit, onDetach, onView, onCreateTask, isAttached = true, releaseStatus }) => {
  const fullAddress = [location.address, location.city, location.state, location.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden hover:border-muted-gray/40 transition-colors cursor-pointer"
      onClick={() => onView(location)}
    >
      {/* Images */}
      {location.images && location.images.length > 0 && (
        <div className="h-32 bg-muted-gray/10">
          <img
            src={location.images[0]}
            alt={location.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-bone-white truncate">{location.name}</h4>
              {location.visibility === 'public' || (location.is_public && !location.visibility) ? (
                <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 shrink-0">
                  <Globe className="w-3 h-3 mr-1" />
                  Public
                </Badge>
              ) : location.visibility === 'unlisted' ? (
                <Badge variant="outline" className="text-xs border-accent-yellow/30 text-accent-yellow shrink-0">
                  <Link2 className="w-3 h-3 mr-1" />
                  Unlisted
                </Badge>
              ) : null}
            </div>
            {location.scene_description_override || location.scene_description ? (
              <p className="text-sm text-accent-yellow font-mono">
                {location.scene_description_override || location.scene_description}
              </p>
            ) : null}
            {location.region_tag && (
              <p className="text-xs text-muted-gray">{location.region_tag}</p>
            )}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(location)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                {onCreateTask && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateTask(location); }}>
                    <FileCheck className="w-4 h-4 mr-2" />
                    Create Task
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-400" onClick={() => onDetach(location.id)}>
                  <Unlink className="w-4 h-4 mr-2" />
                  Detach from Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Project Notes */}
        {location.project_notes && (
          <div className="bg-muted-gray/10 rounded p-2 mb-3 text-sm text-muted-gray">
            <span className="text-xs text-accent-yellow">Project Notes:</span> {location.project_notes}
          </div>
        )}

        {/* Description */}
        {location.description && (
          <p className="text-sm text-muted-gray mb-3 line-clamp-2">{location.description}</p>
        )}

        {/* Address */}
        {fullAddress && (
          <div className="flex items-start gap-2 text-sm text-muted-gray mb-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span>{fullAddress}</span>
              {location.latitude && location.longitude && (
                <a
                  href={`https://maps.google.com/?q=${location.latitude},${location.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 text-accent-yellow hover:underline inline-flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Map
                </a>
              )}
            </div>
          </div>
        )}

        {/* Contact */}
        {(location.contact_name || location.contact_phone || location.contact_email) && (
          <div className="flex flex-wrap gap-3 text-sm text-muted-gray mb-3">
            {location.contact_name && <span>{location.contact_name}</span>}
            {location.contact_phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {location.contact_phone}
              </span>
            )}
            {location.contact_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {location.contact_email}
              </span>
            )}
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {location.location_type && (
            <Badge variant="outline" className="text-xs border-muted-gray/30">
              <Building2 className="w-3 h-3 mr-1" />
              {location.location_type}
            </Badge>
          )}
          {location.power_available && (
            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
              <Plug className="w-3 h-3 mr-1" />
              Power
            </Badge>
          )}
          {location.restrooms_available && (
            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
              Restrooms
            </Badge>
          )}
          {location.permit_required && (
            <Badge
              variant="outline"
              className={`text-xs ${
                location.permit_obtained
                  ? 'border-green-500/30 text-green-400'
                  : 'border-orange-500/30 text-orange-400'
              }`}
            >
              <FileCheck className="w-3 h-3 mr-1" />
              {location.permit_obtained ? 'Permit Obtained' : 'Permit Required'}
            </Badge>
          )}
          {location.location_fee && (
            <Badge variant="outline" className="text-xs border-muted-gray/30">
              <DollarSign className="w-3 h-3 mr-1" />
              ${location.location_fee}
            </Badge>
          )}
          {/* Release Status Badge */}
          {releaseStatus && (
            <Badge
              variant="outline"
              className={`text-xs ${
                releaseStatus === 'signed'
                  ? 'border-green-500/30 text-green-400 bg-green-500/10'
                  : releaseStatus === 'requested'
                  ? 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'
                  : releaseStatus === 'not_started'
                  ? 'border-gray-500/30 text-gray-500'
                  : releaseStatus === 'expired'
                  ? 'border-orange-500/30 text-orange-400 bg-orange-500/10'
                  : releaseStatus === 'rejected'
                  ? 'border-red-500/30 text-red-400 bg-red-500/10'
                  : 'border-gray-500/30 text-gray-500'
              }`}
            >
              <FileCheck className="w-3 h-3 mr-1" />
              Release: {releaseStatus === 'missing' ? 'Missing' : CLEARANCE_STATUS_LABELS[releaseStatus as BacklotClearanceStatus]}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};

// Global Location Search Modal
const GlobalLocationSearchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAttach: (locationId: string, projectNotes?: string) => Promise<void>;
  attachedLocationIds: Set<string>;
}> = ({ isOpen, onClose, onAttach, attachedLocationIds }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [attachingId, setAttachingId] = useState<string | null>(null);

  const { data: regionsData } = useLocationRegions();
  const { data: typesData } = useLocationTypes();

  const { data: searchResults, isLoading } = useGlobalLocationSearch({
    query: searchQuery || undefined,
    region: selectedRegion || undefined,
    location_type: selectedType || undefined,
    limit: 20,
  });

  const handleAttach = async (locationId: string) => {
    setAttachingId(locationId);
    try {
      await onAttach(locationId);
    } finally {
      setAttachingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-accent-yellow" />
            Browse Global Location Library
          </DialogTitle>
          <DialogDescription>
            Search and attach locations from the shared library to your project.
          </DialogDescription>
        </DialogHeader>

        {/* Search & Filters */}
        <div className="space-y-3 py-4 border-b border-muted-gray/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search locations by name, address, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-3">
            <Select value={selectedRegion || 'all'} onValueChange={(v) => setSelectedRegion(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Regions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                {regionsData?.filter(r => r).map((region) => (
                  <SelectItem key={region} value={region}>
                    {region}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType || 'all'} onValueChange={(v) => setSelectedType(v === 'all' ? '' : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {typesData?.filter(t => t).map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto space-y-2 py-4 min-h-[300px]">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : searchResults?.locations && searchResults.locations.length > 0 ? (
            searchResults.locations.map((location) => {
              const isAttached = attachedLocationIds.has(location.id);
              const fullAddress = [location.address, location.city, location.state]
                .filter(Boolean)
                .join(', ');

              return (
                <div
                  key={location.id}
                  className={`flex items-stretch gap-3 p-3 rounded-lg border ${
                    isAttached
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-muted-gray/20 bg-charcoal-black/30 hover:border-muted-gray/40'
                  }`}
                >
                  {/* Scout Photo Thumbnail */}
                  <div className="w-20 h-20 shrink-0 rounded-md overflow-hidden bg-muted-gray/10 flex items-center justify-center">
                    {location.primary_photo_thumbnail || location.primary_photo_url ? (
                      <img
                        src={location.primary_photo_thumbnail || location.primary_photo_url}
                        alt={location.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-muted-gray/40" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-bone-white truncate">{location.name}</h4>
                        {location.location_type && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            {location.location_type}
                          </Badge>
                        )}
                        {location.scout_photo_count > 0 && (
                          <Badge variant="outline" className="text-xs shrink-0 border-accent-yellow/30 text-accent-yellow">
                            <Camera className="w-3 h-3 mr-1" />
                            {location.scout_photo_count}
                          </Badge>
                        )}
                      </div>
                      {fullAddress && (
                        <p className="text-sm text-muted-gray truncate">{fullAddress}</p>
                      )}
                      {location.region_tag && (
                        <p className="text-xs text-muted-gray/60">{location.region_tag}</p>
                      )}
                    </div>

                    {/* Scout Tags */}
                    {location.scout_tags && location.scout_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {location.scout_tags.slice(0, 4).map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs py-0 border-muted-gray/30 text-muted-gray"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {location.scout_tags.length > 4 && (
                          <span className="text-xs text-muted-gray/60">+{location.scout_tags.length - 4}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex items-center">
                    {isAttached ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        <Link2 className="w-3 h-3 mr-1" />
                        Attached
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleAttach(location.id)}
                        disabled={attachingId === location.id}
                        className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                      >
                        {attachingId === location.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 mr-1" />
                            Attach
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-muted-gray">
              <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No locations found in the global library.</p>
              <p className="text-sm mt-1">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LocationsView: React.FC<LocationsViewProps> = ({ projectId, canEdit }) => {
  const {
    locations,
    isLoading,
    createLocation,
    attachLocation,
    detachLocation,
  } = useProjectLocations(projectId);

  // Fetch clearances to show location release status
  const { clearances: locationClearances } = useClearances({
    projectId,
    type: 'location_release',
  });

  // Build a map of location ID -> release status
  const locationReleaseStatusMap = React.useMemo(() => {
    const map = new Map<string, BacklotClearanceStatus | 'missing'>();
    locations.forEach((loc) => {
      const locId = loc.location?.id || loc.id;
      // Find matching clearance for this location
      const matchingClearances = locationClearances.filter(
        (c) => c.related_location_id === locId || c.related_project_location_id === locId
      );
      if (matchingClearances.length === 0) {
        map.set(loc.id, 'missing');
      } else {
        // Pick the best status (signed > requested > not_started > expired)
        const statusPriority: Record<string, number> = {
          signed: 1,
          requested: 2,
          not_started: 3,
          expired: 4,
          rejected: 5,
        };
        const sorted = matchingClearances.sort(
          (a, b) => (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
        );
        map.set(loc.id, sorted[0].status as BacklotClearanceStatus);
      }
    });
    return map;
  }, [locations, locationClearances]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<BacklotLocation | null>(null);
  const [viewingLocation, setViewingLocation] = useState<BacklotLocation | null>(null);
  const [showTipsPanel, setShowTipsPanel] = useState(false);

  // Task creation state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskLocation, setTaskLocation] = useState<BacklotLocation | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('');

  // Task hooks
  const { taskLists } = useTaskLists({ projectId });
  const { createTaskFromSource } = useCreateTaskFromSource(projectId, selectedTaskListId);

  // Get set of attached location IDs for quick lookup
  const attachedLocationIds = new Set(locations.map((l) => l.id));

  const handleCreate = async (data: BacklotLocationInput) => {
    await createLocation.mutateAsync(data);
  };

  const handleAttach = async (locationId: string, projectNotes?: string) => {
    await attachLocation.mutateAsync({
      location_id: locationId,
      project_notes: projectNotes,
    });
  };

  const handleDetach = async (locationId: string) => {
    if (confirm('Are you sure you want to detach this location from your project?')) {
      await detachLocation.mutateAsync(locationId);
    }
  };

  const handleEdit = (location: BacklotLocation) => {
    setEditingLocation(location);
    setShowCreateModal(true);
  };

  const handleView = (location: BacklotLocation) => {
    setViewingLocation(location);
  };

  const handleEditFromDetail = (location: BacklotLocation) => {
    setViewingLocation(null);
    setEditingLocation(location);
    setShowCreateModal(true);
  };

  // Task creation handlers
  const handleOpenTaskModal = (location: BacklotLocation) => {
    setTaskLocation(location);
    setTaskTitle(`Location task: ${location.name}`);
    setTaskDescription(`Location: ${location.name}\nAddress: ${location.address || 'N/A'}`);
    setSelectedTaskListId(taskLists[0]?.id || '');
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!taskLocation || !selectedTaskListId) {
      toast.error('Please select a task list');
      return;
    }

    try {
      await createTaskFromSource.mutateAsync({
        title: taskTitle,
        sourceType: 'location',
        sourceId: taskLocation.id,
        description: taskDescription,
      });
      toast.success('Task created successfully');
      setShowTaskModal(false);
      setTaskLocation(null);
      setTaskTitle('');
      setTaskDescription('');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Locations</h2>
          <p className="text-sm text-muted-gray">Manage your shooting locations</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTipsPanel(true)}
            className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          >
            <HelpCircle className="w-4 h-4 mr-1" />
            Tips
          </Button>
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => setShowSearchModal(true)}
                className="border-muted-gray/30"
              >
                <Globe className="w-4 h-4 mr-2" />
                Browse Library
              </Button>
              <Button
                onClick={() => {
                  setEditingLocation(null);
                  setShowCreateModal(true);
                }}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Location
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Locations Grid */}
      {locations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              canEdit={canEdit}
              onEdit={handleEdit}
              onDetach={handleDetach}
              onView={handleView}
              onCreateTask={handleOpenTaskModal}
              releaseStatus={locationReleaseStatusMap.get(location.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <MapPin className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No locations yet</h3>
          <p className="text-muted-gray mb-4">
            Create a new location or browse the global library to find existing locations.
          </p>
          {canEdit && (
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowSearchModal(true)}
                className="border-muted-gray/30"
              >
                <Globe className="w-4 h-4 mr-2" />
                Browse Library
              </Button>
              <Button
                onClick={() => {
                  setEditingLocation(null);
                  setShowCreateModal(true);
                }}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Location
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateLocationModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setEditingLocation(null);
        }}
        onSubmit={handleCreate}
        editingLocation={editingLocation}
      />

      <GlobalLocationSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onAttach={handleAttach}
        attachedLocationIds={attachedLocationIds}
      />

      <LocationDetailModal
        isOpen={!!viewingLocation}
        onClose={() => setViewingLocation(null)}
        location={viewingLocation}
        canEdit={canEdit}
        onEdit={handleEditFromDetail}
      />

      {/* Create Task Dialog */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent className="bg-soft-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Create Task from Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Task List *</Label>
              <Select value={selectedTaskListId} onValueChange={setSelectedTaskListId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select a task list" />
                </SelectTrigger>
                <SelectContent>
                  {taskLists.map((list) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Task Title *</Label>
              <Input
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Enter task title"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="Enter task description"
                rows={3}
              />
            </div>
            {taskLocation && (
              <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <p className="text-xs text-muted-gray mb-1">Linked to location:</p>
                <p className="text-sm text-bone-white font-medium">{taskLocation.name}</p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={!taskTitle || !selectedTaskListId || createTaskFromSource.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {createTaskFromSource.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tips Panel Dialog */}
      <Dialog open={showTipsPanel} onOpenChange={setShowTipsPanel}>
        <DialogContent className="sm:max-w-lg bg-charcoal-black border-muted-gray/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <HelpCircle className="w-5 h-5 text-amber-400" />
              Locations Tips
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Globe className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Global Library</h4>
                <p className="text-sm text-muted-gray">
                  Browse and attach locations from the shared library, or create new
                  locations that can be reused across projects.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FileCheck className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Location Releases</h4>
                <p className="text-sm text-muted-gray">
                  Track location release status. The badge shows whether the release
                  is signed, requested, or still needed.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent-yellow/10 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-accent-yellow" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Permits & Fees</h4>
                <p className="text-sm text-muted-gray">
                  Mark whether permits are required and track their status. Location
                  fees are automatically synced to your budget.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Camera className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Scout Photos</h4>
                <p className="text-sm text-muted-gray">
                  View scout photos and location details by clicking on a location
                  card. Photos help with planning and continuity.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <MapPin className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h4 className="font-medium text-bone-white">Visibility Settings</h4>
                <p className="text-sm text-muted-gray">
                  Set locations as Public (in global library), Unlisted (link only),
                  or Private (only visible to you).
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowTipsPanel(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationsView;
