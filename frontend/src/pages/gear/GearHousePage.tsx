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
  Settings,
  Users,
  ChevronRight,
  Warehouse,
  Store,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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

import { useGearOrganizations } from '@/hooks/gear';
import type { GearOrganization, OrganizationType } from '@/types/gear';
import { cn } from '@/lib/utils';

const ORG_TYPE_CONFIG: Record<OrganizationType, { label: string; icon: React.ReactNode; color: string }> = {
  production_company: {
    label: 'Production Company',
    icon: <Building2 className="w-5 h-5" />,
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  rental_house: {
    label: 'Rental House',
    icon: <Store className="w-5 h-5" />,
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
  },
  hybrid: {
    label: 'Hybrid',
    icon: <Warehouse className="w-5 h-5" />,
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
};

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
  const config = ORG_TYPE_CONFIG[organization.organization_type];

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
              <div className="w-10 h-10 rounded-lg bg-muted-gray/20 flex items-center justify-center">
                {config.icon}
              </div>
            )}
            <div>
              <CardTitle className="text-bone-white group-hover:text-accent-yellow transition-colors">
                {organization.name}
              </CardTitle>
              <Badge className={cn('border mt-1', config.color)}>{config.label}</Badge>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-muted-gray group-hover:text-accent-yellow transition-colors" />
        </div>
      </CardHeader>
      <CardContent>
        {organization.description && (
          <p className="text-sm text-muted-gray line-clamp-2 mb-3">{organization.description}</p>
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
  onSubmit: (data: {
    name: string;
    organization_type: OrganizationType;
    description?: string;
    contact_email?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

function CreateOrganizationModal({ isOpen, onClose, onSubmit, isSubmitting }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('production_company');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Organization name is required');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        organization_type: orgType,
        description: description.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
      });
      // Reset form
      setName('');
      setOrgType('production_company');
      setDescription('');
      setContactEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create organization');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
          <DialogDescription>
            Set up a new organization to manage equipment and gear
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Production Company"
            />
          </div>

          <div>
            <Label htmlFor="type">Organization Type</Label>
            <Select value={orgType} onValueChange={(v) => setOrgType(v as OrganizationType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ORG_TYPE_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      {config.icon}
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your organization"
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="email">Contact Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@example.com"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

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
