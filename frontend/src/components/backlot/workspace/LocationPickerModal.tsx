/**
 * LocationPickerModal - Modal for selecting locations for call sheets
 * Allows browsing project locations, global library, or creating new locations
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MapPin,
  Search,
  Globe,
  Plus,
  Check,
  Loader2,
  ImageIcon,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  Shield,
  Camera,
  Link2,
  Folder,
} from 'lucide-react';
import {
  useProjectLocations,
  useGlobalLocationSearch,
  useLocationRegions,
  useLocationTypes,
  useProjectLocationsWithClearances,
  useLocations,
} from '@/hooks/backlot';
import { BacklotLocation, LocationWithClearance, BacklotLocationInput } from '@/types/backlot';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSelect: (location: BacklotLocation | LocationWithClearance, projectLocationId?: string) => void;
  onCreateNew?: (data: BacklotLocationInput) => Promise<BacklotLocation>;
  onAttachGlobal?: (locationId: string) => Promise<{ attachment_id: string }>;
}

// Clearance status badge component
const ClearanceBadge: React.FC<{ status?: string }> = ({ status }) => {
  switch (status) {
    case 'approved':
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Cleared
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
          <ShieldQuestion className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    case 'denied':
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
          <ShieldAlert className="w-3 h-3 mr-1" />
          Denied
        </Badge>
      );
    default:
      return (
        <Badge className="bg-muted-gray/20 text-muted-gray border-muted-gray/30 text-xs">
          <Shield className="w-3 h-3 mr-1" />
          No Release
        </Badge>
      );
  }
};

// Location card for display in lists
const LocationListItem: React.FC<{
  location: any;
  onSelect: () => void;
  isSelected?: boolean;
  showClearance?: boolean;
}> = ({ location, onSelect, isSelected, showClearance = false }) => {
  const fullAddress = [location.address, location.city, location.state]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      onClick={onSelect}
      className={`flex items-stretch gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        isSelected
          ? 'border-accent-yellow bg-accent-yellow/10'
          : 'border-muted-gray/20 bg-charcoal-black/30 hover:border-muted-gray/40 hover:bg-charcoal-black/50'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 shrink-0 rounded-md overflow-hidden bg-muted-gray/10 flex items-center justify-center">
        {location.primary_photo_thumbnail || location.primary_photo_url || (location.photos && location.photos[0]) ? (
          <img
            src={location.primary_photo_thumbnail || location.primary_photo_url || location.photos?.[0]}
            alt={location.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-gray/40" />
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-bone-white truncate">{location.name}</h4>
            {location.location_type && (
              <Badge variant="outline" className="text-xs shrink-0">
                {location.location_type}
              </Badge>
            )}
          </div>
          {fullAddress && (
            <p className="text-sm text-muted-gray truncate">{fullAddress}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1">
          {showClearance && <ClearanceBadge status={location.clearance_status} />}
          {location.scout_photo_count > 0 && (
            <Badge variant="outline" className="text-xs border-accent-yellow/30 text-accent-yellow">
              <Camera className="w-3 h-3 mr-1" />
              {location.scout_photo_count}
            </Badge>
          )}
        </div>
      </div>

      {isSelected && (
        <div className="shrink-0 flex items-center">
          <Check className="w-5 h-5 text-accent-yellow" />
        </div>
      )}
    </div>
  );
};

// Quick create form for inline location creation
const QuickCreateForm: React.FC<{
  onCreate: (data: BacklotLocationInput) => void;
  isSubmitting: boolean;
}> = ({ onCreate, isSubmitting }) => {
  const [formData, setFormData] = useState<Partial<BacklotLocationInput>>({
    name: '',
    address: '',
    city: '',
    state: '',
    location_type: '',
    is_public: true,
    visibility: 'public',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name) {
      onCreate(formData as BacklotLocationInput);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="loc-name">Location Name *</Label>
        <Input
          id="loc-name"
          placeholder="e.g., Downtown Office Building"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="loc-address">Street Address</Label>
        <Input
          id="loc-address"
          placeholder="123 Main St"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="loc-city">City</Label>
          <Input
            id="loc-city"
            placeholder="Los Angeles"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            disabled={isSubmitting}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc-state">State</Label>
          <Input
            id="loc-state"
            placeholder="CA"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="loc-type">Location Type</Label>
        <Select
          value={formData.location_type || ''}
          onValueChange={(value) => setFormData({ ...formData, location_type: value })}
          disabled={isSubmitting}
        >
          <SelectTrigger id="loc-type">
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="studio">Studio</SelectItem>
            <SelectItem value="residential">Residential</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="exterior">Exterior</SelectItem>
            <SelectItem value="industrial">Industrial</SelectItem>
            <SelectItem value="nature">Nature</SelectItem>
            <SelectItem value="urban">Urban</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="submit"
        className="w-full bg-accent-yellow text-charcoal-black hover:bg-bone-white"
        disabled={!formData.name || isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <Plus className="w-4 h-4 mr-2" />
        )}
        Create & Select Location
      </Button>
    </form>
  );
};

const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onSelect,
  onCreateNew,
  onAttachGlobal,
}) => {
  const [activeTab, setActiveTab] = useState('project');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Hooks for data fetching
  const { data: projectLocationsData, isLoading: projectLocsLoading } = useProjectLocationsWithClearances(projectId);
  const { data: regionsData } = useLocationRegions();
  const { data: typesData } = useLocationTypes();

  const { data: globalSearchData, isLoading: globalSearchLoading } = useGlobalLocationSearch({
    query: searchQuery || undefined,
    region: selectedRegion || undefined,
    location_type: selectedType || undefined,
    limit: 20,
  });

  const projectLocations = projectLocationsData?.locations || [];
  const globalLocations = globalSearchData?.locations || [];

  // Filter project locations by search
  const filteredProjectLocations = projectLocations.filter((loc: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      loc.name?.toLowerCase().includes(query) ||
      loc.address?.toLowerCase().includes(query) ||
      loc.city?.toLowerCase().includes(query)
    );
  });

  const handleSelectProjectLocation = (location: any) => {
    setSelectedLocation(location);
  };

  const handleSelectGlobalLocation = async (location: BacklotLocation) => {
    if (onAttachGlobal) {
      setIsAttaching(true);
      try {
        const result = await onAttachGlobal(location.id);
        // After attaching, select it
        setSelectedLocation({ ...location, project_location_id: result.attachment_id });
      } catch (err) {
        console.error('Failed to attach location:', err);
      } finally {
        setIsAttaching(false);
      }
    } else {
      setSelectedLocation(location);
    }
  };

  const handleCreateNew = async (data: BacklotLocationInput) => {
    if (onCreateNew) {
      setIsCreating(true);
      try {
        const newLocation = await onCreateNew(data);
        onSelect(newLocation);
        onClose();
      } catch (err) {
        console.error('Failed to create location:', err);
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleConfirmSelection = () => {
    if (selectedLocation) {
      onSelect(selectedLocation, selectedLocation.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-accent-yellow" />
            Select Location
          </DialogTitle>
          <DialogDescription>
            Choose a location from your project library, the global library, or create a new one.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 shrink-0">
            <TabsTrigger value="project" className="flex items-center gap-1">
              <Folder className="w-4 h-4" />
              Project
            </TabsTrigger>
            <TabsTrigger value="global" className="flex items-center gap-1">
              <Globe className="w-4 h-4" />
              Library
            </TabsTrigger>
            <TabsTrigger value="create" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              Create
            </TabsTrigger>
          </TabsList>

          {/* Project Locations Tab */}
          <TabsContent value="project" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                placeholder="Search project locations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-[250px]">
              {projectLocsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : filteredProjectLocations.length > 0 ? (
                filteredProjectLocations.map((location: any) => (
                  <LocationListItem
                    key={location.id}
                    location={location}
                    onSelect={() => handleSelectProjectLocation(location)}
                    isSelected={selectedLocation?.id === location.id}
                    showClearance={true}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-muted-gray">
                  <Folder className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No locations in this project yet.</p>
                  <p className="text-sm mt-1">Browse the global library or create a new location.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Global Library Tab */}
          <TabsContent value="global" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="space-y-3 mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  placeholder="Search global library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-3">
                <Select value={selectedRegion || 'all'} onValueChange={(v) => setSelectedRegion(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regionsData?.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedType || 'all'} onValueChange={(v) => setSelectedType(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {typesData?.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 min-h-[250px]">
              {globalSearchLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20" />
                  ))}
                </div>
              ) : globalLocations.length > 0 ? (
                globalLocations.map((location) => (
                  <div
                    key={location.id}
                    className="relative"
                  >
                    <LocationListItem
                      location={location}
                      onSelect={() => handleSelectGlobalLocation(location)}
                      isSelected={selectedLocation?.id === location.id}
                    />
                    {isAttaching && selectedLocation?.id === location.id && (
                      <div className="absolute inset-0 bg-charcoal-black/50 flex items-center justify-center rounded-lg">
                        <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-gray">
                  <Globe className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>No locations found.</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Create New Tab */}
          <TabsContent value="create" className="flex-1 overflow-y-auto mt-4">
            {onCreateNew ? (
              <QuickCreateForm onCreate={handleCreateNew} isSubmitting={isCreating} />
            ) : (
              <div className="text-center py-12 text-muted-gray">
                <Plus className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Location creation is not available here.</p>
                <p className="text-sm mt-1">Use the Locations tab to create new locations.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="shrink-0 border-t border-muted-gray/20 pt-4 mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSelection}
            disabled={!selectedLocation || activeTab === 'create'}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Check className="w-4 h-4 mr-2" />
            Select Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LocationPickerModal;
