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

import { useGearOrganizations } from '@/hooks/gear';
import type { GearOrganization, CreateOrganizationInput, OrganizationType } from '@/types/gear';
import { cn } from '@/lib/utils';

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

function CreateOrganizationModal({ isOpen, onClose, onSubmit, isSubmitting }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [orgType, setOrgType] = useState<OrganizationType>('production_company');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
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
        org_type: orgType,
        description: description.trim() || undefined,
        website: website.trim() || undefined,
      });
      // Reset form
      setName('');
      setOrgType('production_company');
      setDescription('');
      setWebsite('');
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

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of your organization..."
              rows={3}
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
