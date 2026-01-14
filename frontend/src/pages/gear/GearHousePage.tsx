/**
 * Gear House Main Page
 * Entry point for equipment management - shows organizations list
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Plus,
  Building2,
  Users,
  ChevronRight,
  Loader2,
  Globe,
  MapPin,
  Eye,
  EyeOff,
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { useGearOrganizations } from '@/hooks/gear';
import type { GearOrganization, CreateOrganizationInput, OrganizationType } from '@/types/gear';
import { cn } from '@/lib/utils';
import AddressAutocomplete from '@/components/gear/AddressAutocomplete';

export default function GearHousePage() {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { organizations, isLoading, createOrganization } = useGearOrganizations();

  const handleOrgClick = (org: GearOrganization) => {
    navigate(`/gear/${org.id}`);
  };

  return (
    <div className="min-h-screen bg-charcoal-black p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-yellow/20 rounded-lg">
              <Package className="w-8 h-8 text-accent-yellow" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-bone-white">Gear House</h1>
              <p className="text-muted-gray">Equipment management &amp; tracking</p>
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
              <Package className="w-12 h-12 text-muted-gray mb-4" />
              <h3 className="text-lg font-semibold text-bone-white mb-2">No Organizations Yet</h3>
              <p className="text-muted-gray text-center mb-4">
                Create your first organization to start managing equipment
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
              <OrganizationCard key={org.id} organization={org} onClick={() => handleOrgClick(org)} />
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
    </div>
  );
}

// ============================================================================
// ORGANIZATION CARD
// ============================================================================

interface OrganizationCardProps {
  organization: GearOrganization;
  onClick: () => void;
}

function OrganizationCard({ organization, onClick }: OrganizationCardProps) {
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
          <ChevronRight className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        {organization.description && (
          <p className="text-sm text-muted-gray mb-3 line-clamp-2">{organization.description}</p>
        )}
        <div className="flex items-center gap-4 text-sm text-muted-gray">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>Members</span>
          </div>
          <div className="flex items-center gap-1">
            <Package className="w-4 h-4" />
            <span>Assets</span>
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
  const [orgType, setOrgType] = useState<OrganizationType>('production_company');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');

  // Address fields (required)
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Privacy toggle
  const [hideExactAddress, setHideExactAddress] = useState(false);

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
        hide_exact_address: hideExactAddress,
      });
      // Reset form
      setName('');
      setOrgType('production_company');
      setDescription('');
      setWebsite('');
      setAddressLine1('');
      setCity('');
      setState('');
      setPostalCode('');
      setHideExactAddress(false);
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
            Set up a new organization to manage equipment and gear
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div>
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Production Company"
            />
          </div>

          <div>
            <Label htmlFor="org-type">Organization Type</Label>
            <Select value={orgType} onValueChange={(v) => setOrgType(v as OrganizationType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production_company">Production Company</SelectItem>
                <SelectItem value="rental_house">Rental House</SelectItem>
                <SelectItem value="hybrid">Hybrid (Both)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              Rental Houses default to client rentals, Production Companies default to team checkouts
            </p>
          </div>

          {/* Location Section */}
          <div className="space-y-3 pt-2 border-t border-muted-gray/20">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent-yellow" />
              <Label className="text-bone-white font-medium">Location *</Label>
            </div>
            <p className="text-xs text-muted-gray">
              Your location helps others find your equipment in the marketplace
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
                  <SelectTrigger id="state">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {US_STATES.map((s) => (
                      <SelectItem key={s.code} value={s.code}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="zip">ZIP Code *</Label>
                <Input
                  id="zip"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="90001"
                  maxLength={10}
                />
              </div>
            </div>

            {/* Privacy Toggle */}
            <div className="flex items-center justify-between py-2 px-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
              <div className="flex items-center gap-2">
                {hideExactAddress ? (
                  <EyeOff className="w-4 h-4 text-muted-gray" />
                ) : (
                  <Eye className="w-4 h-4 text-accent-yellow" />
                )}
                <div>
                  <p className="text-sm text-bone-white">Keep address private</p>
                  <p className="text-xs text-muted-gray">
                    {hideExactAddress
                      ? `Only "${city || 'City'}, ${state || 'State'}" will be shown in the marketplace`
                      : 'Full address will be visible in the marketplace'}
                  </p>
                </div>
              </div>
              <Switch
                checked={hideExactAddress}
                onCheckedChange={setHideExactAddress}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your organization..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="website">Website (optional)</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className="pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="max-h-24 overflow-y-auto rounded-md bg-red-500/10 border border-red-500/30 p-3">
              <p className="text-sm text-red-500 whitespace-pre-wrap">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Organization
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
