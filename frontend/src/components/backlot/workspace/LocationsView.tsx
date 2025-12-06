/**
 * LocationsView - Manage shooting locations
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  MapPin,
  Plus,
  Phone,
  Mail,
  Car,
  Plug,
  FileCheck,
  DollarSign,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLocations } from '@/hooks/backlot';
import { BacklotLocation, LocationInput } from '@/types/backlot';

interface LocationsViewProps {
  projectId: string;
  canEdit: boolean;
}

const LocationCard: React.FC<{
  location: BacklotLocation;
  canEdit: boolean;
  onEdit: (location: BacklotLocation) => void;
  onDelete: (id: string) => void;
}> = ({ location, canEdit, onEdit, onDelete }) => {
  const fullAddress = [location.address, location.city, location.state, location.zip]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden hover:border-muted-gray/40 transition-colors">
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
          <div>
            <h4 className="font-medium text-bone-white">{location.name}</h4>
            {location.scene_description && (
              <p className="text-sm text-accent-yellow font-mono">{location.scene_description}</p>
            )}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(location)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-400" onClick={() => onDelete(location.id)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

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
        </div>
      </div>
    </div>
  );
};

const LocationsView: React.FC<LocationsViewProps> = ({ projectId, canEdit }) => {
  const { locations, isLoading, createLocation, updateLocation, deleteLocation } =
    useLocations(projectId);

  const [showForm, setShowForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<BacklotLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<LocationInput>({
    name: '',
    description: '',
    scene_description: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    parking_notes: '',
    power_available: true,
    restrooms_available: true,
    permit_required: false,
    permit_obtained: false,
    location_fee: undefined,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      scene_description: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      contact_name: '',
      contact_phone: '',
      contact_email: '',
      parking_notes: '',
      power_available: true,
      restrooms_available: true,
      permit_required: false,
      permit_obtained: false,
      location_fee: undefined,
    });
  };

  const handleOpenForm = (location?: BacklotLocation) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        name: location.name,
        description: location.description || '',
        scene_description: location.scene_description || '',
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        zip: location.zip || '',
        contact_name: location.contact_name || '',
        contact_phone: location.contact_phone || '',
        contact_email: location.contact_email || '',
        parking_notes: location.parking_notes || '',
        power_available: location.power_available,
        restrooms_available: location.restrooms_available,
        permit_required: location.permit_required,
        permit_obtained: location.permit_obtained,
        location_fee: location.location_fee || undefined,
      });
    } else {
      setEditingLocation(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingLocation) {
        await updateLocation.mutateAsync({
          id: editingLocation.id,
          ...formData,
        });
      } else {
        await createLocation.mutateAsync({
          projectId,
          ...formData,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save location:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this location?')) {
      await deleteLocation.mutateAsync(id);
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
        {canEdit && (
          <Button
            onClick={() => handleOpenForm()}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        )}
      </div>

      {/* Locations Grid */}
      {locations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              canEdit={canEdit}
              onEdit={handleOpenForm}
              onDelete={handleDelete}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <MapPin className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No locations yet</h3>
          <p className="text-muted-gray mb-4">Add locations where you'll be shooting.</p>
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </Button>
          )}
        </div>
      )}

      {/* Location Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingLocation ? 'Edit Location' : 'Add Location'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Malibu Beach"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scene_description">Scene Description</Label>
              <Input
                id="scene_description"
                placeholder="e.g., EXT. BEACH - DAY"
                value={formData.scene_description}
                onChange={(e) => setFormData({ ...formData, scene_description: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  value={formData.zip}
                  onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Additional details about the location..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact Name</Label>
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Amenities */}
            <div className="space-y-3">
              <Label>Amenities</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-gray">Power Available</span>
                <Switch
                  checked={formData.power_available}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, power_available: checked })
                  }
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-gray">Restrooms Available</span>
                <Switch
                  checked={formData.restrooms_available}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, restrooms_available: checked })
                  }
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Permit */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-gray">Permit Required</span>
                <Switch
                  checked={formData.permit_required}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, permit_required: checked })
                  }
                  disabled={isSubmitting}
                />
              </div>
              {formData.permit_required && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-gray">Permit Obtained</span>
                  <Switch
                    checked={formData.permit_obtained}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, permit_obtained: checked })
                    }
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="location_fee">Location Fee ($)</Label>
              <Input
                id="location_fee"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={formData.location_fee || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    location_fee: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingLocation ? (
                  'Save Changes'
                ) : (
                  'Add Location'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LocationsView;
