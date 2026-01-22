/**
 * Set House Main Page
 * Entry point for space/location management - shows organizations list
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Users,
  ChevronRight,
  MapPin,
  Home,
  MoreVertical,
  Pencil,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useSetHouseOrganizations } from '@/hooks/set-house';
import type { SetHouseOrganization, CreateOrganizationInput, SetHouseOrganizationType } from '@/types/set-house';
import AddressAutocomplete from '@/components/gear/AddressAutocomplete';

export default function SetHousePage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<SetHouseOrganization | null>(null);

  const { organizations, isLoading, createOrganization, updateOrganization } = useSetHouseOrganizations();

  const handleOrgClick = (org: SetHouseOrganization) => {
    navigate(`/set-house/${org.id}`);
  };

  const handleEditOrg = (e: React.MouseEvent, org: SetHouseOrganization) => {
    e.stopPropagation();
    setEditingOrg(org);
  };

  return (
    <div className="min-h-screen bg-charcoal-black p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-yellow/20 rounded-lg">
              <Building2 className="w-8 h-8 text-accent-yellow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-bone-white">Set House</h1>
              <p className="text-muted-gray">Space &amp; location management</p>
            </div>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Organization
          </Button>
        </div>

        {/* Organizations Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : organizations.length === 0 ? (
          <Card className="bg-charcoal-black/50 border-muted-gray/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-muted-gray mb-4" />
              <h3 className="text-lg font-semibold text-bone-white mb-2">No Organizations Yet</h3>
              <p className="text-muted-gray text-center mb-4">
                Create your first organization to start managing spaces and locations
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Organization
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {organizations.map((org) => (
              <OrganizationCard
                key={org.id}
                organization={org}
                onClick={() => handleOrgClick(org)}
                onEdit={(e) => handleEditOrg(e, org)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (data) => {
          await createOrganization.mutateAsync(data);
          setIsCreateModalOpen(false);
        }}
        isSubmitting={createOrganization.isPending}
      />

      {/* Edit Organization Modal */}
      {editingOrg && (
        <EditOrganizationModal
          isOpen={!!editingOrg}
          onClose={() => setEditingOrg(null)}
          organization={editingOrg}
          onSubmit={async (data) => {
            await updateOrganization.mutateAsync({ orgId: editingOrg.id, ...data });
            setEditingOrg(null);
          }}
          isSubmitting={updateOrganization.isPending}
        />
      )}
    </div>
  );
}

// ============================================================================
// ORGANIZATION CARD
// ============================================================================

interface OrganizationCardProps {
  organization: SetHouseOrganization;
  onClick: () => void;
  onEdit: (e: React.MouseEvent) => void;
}

function OrganizationCard({ organization, onClick, onEdit }: OrganizationCardProps) {
  return (
    <Card
      className="bg-charcoal-black/50 border-muted-gray/30 hover:border-accent-yellow/50 transition-colors cursor-pointer group"
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {organization.logo_url ? (
              <img
                src={organization.logo_url}
                alt={organization.name}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-accent-yellow/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-accent-yellow" />
              </div>
            )}
            <div>
              <CardTitle className="text-bone-white group-hover:text-accent-yellow transition-colors">
                {organization.name}
              </CardTitle>
              {organization.role && (
                <Badge className="border mt-1 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30 capitalize">
                  {organization.role}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4 text-muted-gray" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Organization
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ChevronRight className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {organization.description && (
          <p className="text-sm text-muted-gray mb-3 line-clamp-2">{organization.description}</p>
        )}
        {organization.city && organization.state && (
          <div className="flex items-center gap-1 text-sm text-muted-gray mb-3">
            <MapPin className="w-4 h-4" />
            <span>{organization.city}, {organization.state}</span>
          </div>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-gray">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>Members</span>
          </div>
          <div className="flex items-center gap-1">
            <Home className="w-4 h-4" />
            <span>Spaces</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE ORGANIZATION MODAL
// ============================================================================

interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateOrganizationInput) => Promise<void>;
  isSubmitting: boolean;
}

// US State abbreviations for select
const US_STATES = [
  { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }, { code: 'DC', name: 'Washington D.C.' },
];

function CreateOrganizationModal({ isOpen, onClose, onSubmit, isSubmitting }: CreateOrganizationModalProps) {
  // Basic info
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<SetHouseOrganizationType>('studio');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');

  // Address fields (required)
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }
    if (!addressLine1.trim()) {
      setError('Street address is required');
      return;
    }
    if (!city.trim()) {
      setError('City is required');
      return;
    }
    if (!state) {
      setError('State is required');
      return;
    }
    if (!postalCode.trim()) {
      setError('ZIP code is required');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        org_type: orgType,
        description: description.trim() || undefined,
        website: website.trim() || undefined,
        address_line1: addressLine1.trim(),
        city: city.trim(),
        state: state,
        postal_code: postalCode.trim(),
        country: 'US',
      });
      // Reset form
      setName('');
      setOrgType('studio');
      setDescription('');
      setWebsite('');
      setAddressLine1('');
      setCity('');
      setState('');
      setPostalCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Set up a new organization to manage spaces and locations
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div>
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Studio"
            />
          </div>

          <div>
            <Label htmlFor="org-type">Organization Type</Label>
            <Select value={orgType} onValueChange={(v) => setOrgType(v as SetHouseOrganizationType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="location_house">Location House</SelectItem>
                <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              Studios focus on stage rentals, Location Houses manage external locations
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your organization..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
            />
          </div>

          {/* Location Section */}
          <div className="space-y-3 pt-2 border-t border-muted-gray/20">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent-yellow" />
              <Label className="text-bone-white font-medium">Location *</Label>
            </div>
            <p className="text-xs text-muted-gray">
              Your location helps others find your spaces in the marketplace
            </p>

            <div>
              <Label htmlFor="address">Street Address *</Label>
              <AddressAutocomplete
                value={addressLine1}
                onChange={setAddressLine1}
                onSelect={(suggestion) => {
                  // Auto-fill address fields from suggestion
                  if (suggestion.street) setAddressLine1(suggestion.street);
                  if (suggestion.city) setCity(suggestion.city);
                  if (suggestion.state) setState(suggestion.state);
                  if (suggestion.postal_code) setPostalCode(suggestion.postal_code);
                }}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <Label htmlFor="state">State *</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="postal">ZIP Code *</Label>
              <Input
                id="postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="90001"
                className="w-32"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-primary-red">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// EDIT ORGANIZATION MODAL
// ============================================================================

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: SetHouseOrganization;
  onSubmit: (data: Partial<CreateOrganizationInput>) => Promise<void>;
  isSubmitting: boolean;
}

function EditOrganizationModal({ isOpen, onClose, organization, onSubmit, isSubmitting }: EditOrganizationModalProps) {
  // Basic info - pre-populate with existing values
  const [name, setName] = useState(organization.name);
  const [orgType, setOrgType] = useState<SetHouseOrganizationType>(
    (organization.org_type as SetHouseOrganizationType) || 'studio'
  );
  const [description, setDescription] = useState(organization.description || '');
  const [website, setWebsite] = useState(organization.website || '');

  // Address fields
  const [addressLine1, setAddressLine1] = useState(organization.address_line1 || '');
  const [city, setCity] = useState(organization.city || '');
  const [state, setState] = useState(organization.state || '');
  const [postalCode, setPostalCode] = useState(organization.postal_code || '');

  const [error, setError] = useState<string | null>(null);

  // Update form when organization changes
  React.useEffect(() => {
    setName(organization.name);
    setOrgType((organization.org_type as SetHouseOrganizationType) || 'studio');
    setDescription(organization.description || '');
    setWebsite(organization.website || '');
    setAddressLine1(organization.address_line1 || '');
    setCity(organization.city || '');
    setState(organization.state || '');
    setPostalCode(organization.postal_code || '');
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }
    if (!addressLine1.trim()) {
      setError('Street address is required');
      return;
    }
    if (!city.trim()) {
      setError('City is required');
      return;
    }
    if (!state) {
      setError('State is required');
      return;
    }
    if (!postalCode.trim()) {
      setError('ZIP code is required');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        org_type: orgType,
        description: description.trim() || undefined,
        website: website.trim() || undefined,
        address_line1: addressLine1.trim(),
        city: city.trim(),
        state: state,
        postal_code: postalCode.trim(),
        country: 'US',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update organization');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Organization</DialogTitle>
          <DialogDescription>
            Update your organization details
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div>
            <Label htmlFor="edit-name">Organization Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Studio"
            />
          </div>

          <div>
            <Label htmlFor="edit-org-type">Organization Type</Label>
            <Select value={orgType} onValueChange={(v) => setOrgType(v as SetHouseOrganizationType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="studio">Studio</SelectItem>
                <SelectItem value="location_house">Location House</SelectItem>
                <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
                <SelectItem value="agency">Agency</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              Studios focus on stage rentals, Location Houses manage external locations
            </p>
          </div>

          <div>
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your organization..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="edit-website">Website</Label>
            <Input
              id="edit-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
            />
          </div>

          {/* Location Section */}
          <div className="space-y-3 pt-2 border-t border-muted-gray/20">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent-yellow" />
              <Label className="text-bone-white font-medium">Location *</Label>
            </div>
            <p className="text-xs text-muted-gray">
              Your location helps others find your spaces in the marketplace
            </p>

            <div>
              <Label htmlFor="edit-address">Street Address *</Label>
              <AddressAutocomplete
                value={addressLine1}
                onChange={setAddressLine1}
                onSelect={(suggestion) => {
                  if (suggestion.street) setAddressLine1(suggestion.street);
                  if (suggestion.city) setCity(suggestion.city);
                  if (suggestion.state) setState(suggestion.state);
                  if (suggestion.postal_code) setPostalCode(suggestion.postal_code);
                }}
                placeholder="Start typing an address..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-city">City *</Label>
                <Input
                  id="edit-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Los Angeles"
                />
              </div>
              <div>
                <Label htmlFor="edit-state">State *</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit-postal">ZIP Code *</Label>
              <Input
                id="edit-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="90001"
                className="w-32"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-primary-red">{error}</div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
