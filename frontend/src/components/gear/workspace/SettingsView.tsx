/**
 * Settings View
 * Manage organization settings, members, categories, and locations
 */
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  FolderTree,
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Check,
  X,
  Shield,
  ScanBarcode,
  Store,
  Globe,
  CreditCard,
  Truck,
  CalendarClock,
  BadgeCheck,
  DollarSign,
  Percent,
  Mail,
  Phone,
  Link,
  Package,
  Clock,
  Home,
  Building2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  Eye,
  EyeOff,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { Textarea } from '@/components/ui/textarea';
import {
  useGearOrgMembers,
  useGearOrgSettings,
  useGearCategories,
  useGearLocations,
  useGearOrganization,
} from '@/hooks/gear';
import { useMarketplaceSettings, useShippingSettings, useUpdateLocationPrivacy } from '@/hooks/gear/useGearMarketplace';
import type {
  GearOrganization,
  GearOrganizationMember,
  OrganizationMemberRole,
  OrganizationType,
  ListerType,
  ExtensionPolicy,
  ShippingCarrier,
  ShippingPricingMode,
  ShippingAddress,
} from '@/types/gear';
import { cn } from '@/lib/utils';

const ROLE_CONFIG: Record<OrganizationMemberRole, { label: string; color: string }> = {
  owner: { label: 'Owner', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  admin: { label: 'Admin', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  manager: { label: 'Manager', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  member: { label: 'Member', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

interface SettingsViewProps {
  orgId: string;
  organization: GearOrganization;
}

export function SettingsView({ orgId, organization }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'marketplace' | 'delivery' | 'verification' | 'members' | 'categories' | 'locations'>(
    'general'
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 flex-wrap h-auto">
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="marketplace">
            <Store className="w-4 h-4 mr-2" />
            Marketplace
          </TabsTrigger>
          <TabsTrigger value="delivery">
            <Package className="w-4 h-4 mr-2" />
            Delivery
          </TabsTrigger>
          <TabsTrigger value="verification">
            <ScanBarcode className="w-4 h-4 mr-2" />
            Verification
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger value="categories">
            <FolderTree className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="locations">
            <MapPin className="w-4 h-4 mr-2" />
            Locations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <GeneralSettings orgId={orgId} organization={organization} />
        </TabsContent>

        <TabsContent value="marketplace" className="mt-6">
          <MarketplaceSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="delivery" className="mt-6">
          <DeliverySettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="verification" className="mt-6">
          <VerificationSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <CategoriesSettings orgId={orgId} />
        </TabsContent>

        <TabsContent value="locations" className="mt-6">
          <LocationsSettings orgId={orgId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================================
// GENERAL SETTINGS
// ============================================================================

const ORG_TYPE_OPTIONS: { value: OrganizationType; label: string; description: string }[] = [
  { value: 'production_company', label: 'Production Company', description: 'Default to team member checkouts' },
  { value: 'rental_house', label: 'Rental House', description: 'Default to client rentals' },
  { value: 'hybrid', label: 'Hybrid (Both)', description: 'No default preference' },
];

function GeneralSettings({ orgId, organization }: { orgId: string; organization: GearOrganization }) {
  const { settings, isLoading, updateSettings } = useGearOrgSettings(orgId);
  const { updateOrganization } = useGearOrganization(orgId);

  // Local state for number/text inputs (saves on blur)
  const [localCheckoutDuration, setLocalCheckoutDuration] = useState('7');
  const [localBarcodePrefix, setLocalBarcodePrefix] = useState('');
  const [localStrikesBeforeSuspension, setLocalStrikesBeforeSuspension] = useState('3');

  // Sync local state when settings load
  useEffect(() => {
    if (settings) {
      setLocalCheckoutDuration(String(settings.default_checkout_duration_days ?? 7));
      setLocalBarcodePrefix(settings.barcode_prefix ?? '');
      setLocalStrikesBeforeSuspension(String(settings.strikes_before_suspension ?? 3));
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Organization Type */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Organization Type</CardTitle>
          <CardDescription>Define your organization's primary function</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Type</Label>
            <Select
              value={organization.org_type || 'production_company'}
              onValueChange={(value) => updateOrganization.mutate({ org_type: value as OrganizationType })}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-gray mt-2">
              {ORG_TYPE_OPTIONS.find((o) => o.value === (organization.org_type || 'production_company'))?.description}
            </p>
            <p className="text-xs text-muted-gray mt-1">
              This sets the default checkout mode. Both team member and client rental options remain available.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Checkout Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Checkout Settings</CardTitle>
          <CardDescription>Configure default checkout behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Default Checkout Duration (days)</Label>
              <Input
                type="number"
                value={localCheckoutDuration}
                className="w-32"
                onChange={(e) => setLocalCheckoutDuration(e.target.value)}
                onBlur={() => {
                  const value = parseInt(localCheckoutDuration, 10) || 7;
                  if (value !== (settings?.default_checkout_duration_days ?? 7)) {
                    updateSettings.mutate({ default_checkout_duration_days: value });
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Condition Photo Requirements</Label>
            <div className="space-y-2 pl-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">On intake (new assets)</span>
                <Switch
                  checked={settings?.require_photos_on_intake ?? false}
                  onCheckedChange={(checked) => updateSettings.mutate({ require_photos_on_intake: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">On checkout</span>
                <Switch
                  checked={settings?.require_photos_on_checkout ?? false}
                  onCheckedChange={(checked) => updateSettings.mutate({ require_photos_on_checkout: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">On check-in</span>
                <Switch
                  checked={settings?.require_photos_on_checkin ?? false}
                  onCheckedChange={(checked) => updateSettings.mutate({ require_photos_on_checkin: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">When reporting damage</span>
                <Switch
                  checked={settings?.require_photos_on_damage ?? false}
                  onCheckedChange={(checked) => updateSettings.mutate({ require_photos_on_damage: checked })}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Barcode Settings</CardTitle>
          <CardDescription>Configure barcode generation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-generate Barcodes</Label>
              <p className="text-sm text-muted-gray">Automatically generate barcodes for new assets</p>
            </div>
            <Switch
              checked={settings?.auto_generate_barcodes ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ auto_generate_barcodes: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Barcode Format</Label>
              <Select
                value={settings?.barcode_format ?? 'CODE128'}
                onValueChange={(value) => updateSettings.mutate({ barcode_format: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">Code 128</SelectItem>
                  <SelectItem value="CODE39">Code 39</SelectItem>
                  <SelectItem value="EAN13">EAN-13</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Barcode Prefix</Label>
              <Input
                value={localBarcodePrefix}
                placeholder="e.g., GH-"
                onChange={(e) => setLocalBarcodePrefix(e.target.value)}
                onBlur={() => {
                  if (localBarcodePrefix !== (settings?.barcode_prefix ?? '')) {
                    updateSettings.mutate({ barcode_prefix: localBarcodePrefix });
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strike Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Strike System</CardTitle>
          <CardDescription>Configure user accountability</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Strikes</Label>
              <p className="text-sm text-muted-gray">Track user violations with strikes</p>
            </div>
            <Switch
              checked={settings?.enable_strikes ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ enable_strikes: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-apply Strikes</Label>
              <p className="text-sm text-muted-gray">Automatically issue strikes based on rules</p>
            </div>
            <Switch
              checked={settings?.enable_auto_strikes ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ enable_auto_strikes: checked })}
            />
          </div>

          <div>
            <Label>Strikes Before Suspension</Label>
            <Input
              type="number"
              value={localStrikesBeforeSuspension}
              className="w-32"
              onChange={(e) => setLocalStrikesBeforeSuspension(e.target.value)}
              onBlur={() => {
                const value = parseInt(localStrikesBeforeSuspension, 10) || 3;
                if (value !== (settings?.strikes_before_suspension ?? 3)) {
                  updateSettings.mutate({ strikes_before_suspension: value });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <LocationSettingsCard orgId={orgId} organization={organization} />
    </div>
  );
}

// ============================================================================
// MARKETPLACE SETTINGS
// ============================================================================

const LISTER_TYPE_OPTIONS: { value: ListerType; label: string; description: string }[] = [
  { value: 'individual', label: 'Individual', description: 'Personal gear owner' },
  { value: 'production_company', label: 'Production Company', description: 'Production company with gear inventory' },
  { value: 'rental_house', label: 'Rental House', description: 'Professional rental business' },
];

const EXTENSION_POLICY_OPTIONS: { value: ExtensionPolicy; label: string; description: string }[] = [
  { value: 'request_approve', label: 'Request & Approve', description: 'Renters must request, you approve/deny' },
  { value: 'auto_extend', label: 'Auto-Extend', description: 'Automatically extend if not reserved' },
  { value: 'negotiated', label: 'Negotiated', description: 'Extension triggers new quote process' },
];

function MarketplaceSettings({ orgId }: { orgId: string }) {
  const { settings, isLoading, updateSettings } = useMarketplaceSettings(orgId);

  // Local state for text inputs (saves on blur, not on every keystroke)
  const [localName, setLocalName] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localLocation, setLocalLocation] = useState('');
  const [localWebsite, setLocalWebsite] = useState('');
  const [localEmail, setLocalEmail] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [localDepositPercent, setLocalDepositPercent] = useState('0');
  const [localDeliveryRadius, setLocalDeliveryRadius] = useState('50');
  const [localDeliveryBaseFee, setLocalDeliveryBaseFee] = useState('0');
  const [localDeliveryPerMileFee, setLocalDeliveryPerMileFee] = useState('0');
  const [localAutoExtendDays, setLocalAutoExtendDays] = useState('3');

  // Sync local state when settings load
  useEffect(() => {
    if (settings) {
      setLocalName(settings.marketplace_name ?? '');
      setLocalDescription(settings.marketplace_description ?? '');
      setLocalLocation(settings.marketplace_location ?? '');
      setLocalWebsite(settings.marketplace_website ?? '');
      setLocalEmail(settings.contact_email ?? '');
      setLocalPhone(settings.contact_phone ?? '');
      setLocalDepositPercent(String(settings.default_deposit_percent ?? 0));
      setLocalDeliveryRadius(String(settings.delivery_radius_miles ?? 50));
      setLocalDeliveryBaseFee(String(settings.delivery_base_fee ?? 0));
      setLocalDeliveryPerMileFee(String(settings.delivery_per_mile_fee ?? 0));
      setLocalAutoExtendDays(String(settings.auto_extend_max_days ?? 3));
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Marketplace Profile */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="w-4 h-4" />
            Marketplace Profile
          </CardTitle>
          <CardDescription>
            Configure how your organization appears in the marketplace
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Marketplace Listing</Label>
              <p className="text-sm text-muted-gray">
                Allow your gear to be discovered and rented by other organizations
              </p>
            </div>
            <Switch
              checked={settings?.is_marketplace_enabled ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ is_marketplace_enabled: checked })}
            />
          </div>

          {settings?.is_marketplace_enabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Lister Type</Label>
                  <Select
                    value={settings?.lister_type ?? 'production_company'}
                    onValueChange={(value) =>
                      updateSettings.mutate({ lister_type: value as ListerType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LISTER_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-gray mt-1">
                    {LISTER_TYPE_OPTIONS.find((o) => o.value === settings?.lister_type)?.description}
                  </p>
                </div>

                <div>
                  <Label>Marketplace Name</Label>
                  <Input
                    value={localName}
                    placeholder="Your marketplace display name"
                    onChange={(e) => setLocalName(e.target.value)}
                    onBlur={() => {
                      if (localName !== (settings?.marketplace_name ?? '')) {
                        updateSettings.mutate({ marketplace_name: localName });
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={localDescription}
                  placeholder="Describe your rental services, specialties, or inventory highlights..."
                  rows={3}
                  onChange={(e) => setLocalDescription(e.target.value)}
                  onBlur={() => {
                    if (localDescription !== (settings?.marketplace_description ?? '')) {
                      updateSettings.mutate({ marketplace_description: localDescription });
                    }
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <MapPin className="w-3 h-3" />
                    Location
                  </Label>
                  <Input
                    value={localLocation}
                    placeholder="e.g., Los Angeles, CA"
                    onChange={(e) => setLocalLocation(e.target.value)}
                    onBlur={() => {
                      if (localLocation !== (settings?.marketplace_location ?? '')) {
                        updateSettings.mutate({ marketplace_location: localLocation });
                      }
                    }}
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Link className="w-3 h-3" />
                    Website
                  </Label>
                  <Input
                    value={localWebsite}
                    placeholder="https://..."
                    onChange={(e) => setLocalWebsite(e.target.value)}
                    onBlur={() => {
                      if (localWebsite !== (settings?.marketplace_website ?? '')) {
                        updateSettings.mutate({ marketplace_website: localWebsite });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="flex items-center gap-2">
                    <Mail className="w-3 h-3" />
                    Contact Email
                  </Label>
                  <Input
                    type="email"
                    value={localEmail}
                    placeholder="rentals@example.com"
                    onChange={(e) => setLocalEmail(e.target.value)}
                    onBlur={() => {
                      if (localEmail !== (settings?.contact_email ?? '')) {
                        updateSettings.mutate({ contact_email: localEmail });
                      }
                    }}
                  />
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Phone className="w-3 h-3" />
                    Contact Phone
                  </Label>
                  <Input
                    value={localPhone}
                    placeholder="(555) 123-4567"
                    onChange={(e) => setLocalPhone(e.target.value)}
                    onBlur={() => {
                      if (localPhone !== (settings?.contact_phone ?? '')) {
                        updateSettings.mutate({ contact_phone: localPhone });
                      }
                    }}
                  />
                </div>
              </div>

              {/* Verification Status */}
              <div className="flex items-center justify-between rounded-lg bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <BadgeCheck className={cn(
                    "w-6 h-6",
                    settings?.is_verified ? "text-green-400" : "text-muted-gray"
                  )} />
                  <div>
                    <p className="font-medium text-bone-white">Verification Status</p>
                    <p className="text-sm text-muted-gray">
                      {settings?.is_verified
                        ? `Verified on ${settings?.verified_at ? new Date(settings.verified_at).toLocaleDateString() : 'N/A'}`
                        : `${settings?.successful_rentals_count ?? 0} successful rentals (5 needed for verification)`}
                    </p>
                  </div>
                </div>
                {settings?.is_verified ? (
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Verified</Badge>
                ) : (
                  <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Unverified</Badge>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pricing Defaults */}
      {settings?.is_marketplace_enabled && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Pricing & Deposits
            </CardTitle>
            <CardDescription>
              Set default pricing policies for your listings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require Deposit</Label>
                <p className="text-sm text-muted-gray">
                  Require a security deposit for all rentals
                </p>
              </div>
              <Switch
                checked={settings?.require_deposit ?? false}
                onCheckedChange={(checked) => updateSettings.mutate({ require_deposit: checked })}
              />
            </div>

            {settings?.require_deposit && (
              <div className="w-48">
                <Label>Default Deposit (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={localDepositPercent}
                  onChange={(e) => setLocalDepositPercent(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(localDepositPercent) || 0;
                    if (value !== (settings?.default_deposit_percent ?? 0)) {
                      updateSettings.mutate({ default_deposit_percent: value });
                    }
                  }}
                />
                <p className="text-xs text-muted-gray mt-1">
                  Percentage of rental total required as deposit
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Require Insurance</Label>
                <p className="text-sm text-muted-gray">
                  Require renters to have insurance by default
                </p>
              </div>
              <Switch
                checked={settings?.default_insurance_required ?? false}
                onCheckedChange={(checked) => updateSettings.mutate({ default_insurance_required: checked })}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delivery Settings */}
      {settings?.is_marketplace_enabled && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Delivery Options
            </CardTitle>
            <CardDescription>
              Configure delivery services for your rentals
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Offer Delivery</Label>
                <p className="text-sm text-muted-gray">
                  Deliver equipment to renters
                </p>
              </div>
              <Switch
                checked={settings?.offers_delivery ?? false}
                onCheckedChange={(checked) => updateSettings.mutate({ offers_delivery: checked })}
              />
            </div>

            {settings?.offers_delivery && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Delivery Radius (miles)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={localDeliveryRadius}
                    onChange={(e) => setLocalDeliveryRadius(e.target.value)}
                    onBlur={() => {
                      const value = parseInt(localDeliveryRadius, 10) || 0;
                      if (value !== (settings?.delivery_radius_miles ?? 50)) {
                        updateSettings.mutate({ delivery_radius_miles: value });
                      }
                    }}
                  />
                </div>

                <div>
                  <Label>Base Fee ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={localDeliveryBaseFee}
                    onChange={(e) => setLocalDeliveryBaseFee(e.target.value)}
                    onBlur={() => {
                      const value = parseFloat(localDeliveryBaseFee) || 0;
                      if (value !== (settings?.delivery_base_fee ?? 0)) {
                        updateSettings.mutate({ delivery_base_fee: value });
                      }
                    }}
                  />
                </div>

                <div>
                  <Label>Per Mile Fee ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={localDeliveryPerMileFee}
                    onChange={(e) => setLocalDeliveryPerMileFee(e.target.value)}
                    onBlur={() => {
                      const value = parseFloat(localDeliveryPerMileFee) || 0;
                      if (value !== (settings?.delivery_per_mile_fee ?? 0)) {
                        updateSettings.mutate({ delivery_per_mile_fee: value });
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Extension Policy */}
      {settings?.is_marketplace_enabled && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              Extension Policy
            </CardTitle>
            <CardDescription>
              How should rental extension requests be handled?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Extension Policy</Label>
              <Select
                value={settings?.extension_policy ?? 'request_approve'}
                onValueChange={(value) =>
                  updateSettings.mutate({ extension_policy: value as ExtensionPolicy })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXTENSION_POLICY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-gray mt-2">
                {EXTENSION_POLICY_OPTIONS.find((o) => o.value === settings?.extension_policy)?.description}
              </p>
            </div>

            {settings?.extension_policy === 'auto_extend' && (
              <div className="w-48">
                <Label>Max Auto-Extend Days</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={localAutoExtendDays}
                  onChange={(e) => setLocalAutoExtendDays(e.target.value)}
                  onBlur={() => {
                    const value = parseInt(localAutoExtendDays, 10) || 3;
                    if (value !== (settings?.auto_extend_max_days ?? 3)) {
                      updateSettings.mutate({ auto_extend_max_days: value });
                    }
                  }}
                />
                <p className="text-xs text-muted-gray mt-1">
                  Maximum days to auto-extend without approval
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Settings */}
      {settings?.is_marketplace_enabled && (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment Methods
            </CardTitle>
            <CardDescription>
              Configure accepted payment methods
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Accept Credit Card (Stripe)</Label>
                <p className="text-sm text-muted-gray">
                  Accept credit card payments via Stripe
                </p>
              </div>
              <Switch
                checked={settings?.accepts_stripe ?? true}
                onCheckedChange={(checked) => updateSettings.mutate({ accepts_stripe: checked })}
              />
            </div>

            {settings?.accepts_stripe && !settings?.stripe_account_id && (
              <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
                <p className="text-sm text-yellow-400">
                  Stripe account not connected. Connect your Stripe account to accept card payments.
                </p>
                <Button variant="outline" size="sm" className="mt-2">
                  Connect Stripe
                </Button>
              </div>
            )}

            {settings?.accepts_stripe && settings?.stripe_account_id && (
              <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-4">
                <p className="text-sm text-green-400">
                  Stripe account connected and ready to accept payments.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label>Accept Invoice / Net Terms</Label>
                <p className="text-sm text-muted-gray">
                  Allow renters to pay via invoice
                </p>
              </div>
              <Switch
                checked={settings?.accepts_invoice ?? true}
                onCheckedChange={(checked) => updateSettings.mutate({ accepts_invoice: checked })}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// DELIVERY SETTINGS
// ============================================================================

const SHIPPING_CARRIERS: { value: ShippingCarrier; label: string; logo?: string }[] = [
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
];

const PRICING_MODE_OPTIONS: { value: ShippingPricingMode; label: string; description: string }[] = [
  { value: 'real_time', label: 'Real-Time Rates', description: 'Get live carrier rates at checkout' },
  { value: 'flat_rate', label: 'Flat Rate', description: 'Set fixed shipping prices' },
  { value: 'both', label: 'Both Options', description: 'Offer both real-time and flat rate shipping' },
];

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const WEEKDAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

function DeliverySettings({ orgId }: { orgId: string }) {
  const { settings, isLoading, updateSettings, verifyAddress } = useShippingSettings(orgId);

  // Local state for text/number inputs (saves on blur)
  const [localPickupAddress, setLocalPickupAddress] = useState('');
  const [localPickupInstructions, setLocalPickupInstructions] = useState('');
  const [localDeliveryRadius, setLocalDeliveryRadius] = useState('50');
  const [localDeliveryBaseFee, setLocalDeliveryBaseFee] = useState('0');
  const [localDeliveryPerMileFee, setLocalDeliveryPerMileFee] = useState('0');
  const [localFreeShippingThreshold, setLocalFreeShippingThreshold] = useState('');
  const [localFlatRateGround, setLocalFlatRateGround] = useState('');
  const [localFlatRateExpress, setLocalFlatRateExpress] = useState('');
  const [localFlatRateOvernight, setLocalFlatRateOvernight] = useState('');

  // Ship-from address fields
  const [localShipName, setLocalShipName] = useState('');
  const [localShipCompany, setLocalShipCompany] = useState('');
  const [localShipStreet1, setLocalShipStreet1] = useState('');
  const [localShipStreet2, setLocalShipStreet2] = useState('');
  const [localShipCity, setLocalShipCity] = useState('');
  const [localShipState, setLocalShipState] = useState('');
  const [localShipZip, setLocalShipZip] = useState('');
  const [localShipPhone, setLocalShipPhone] = useState('');

  // Pickup hours state
  const [pickupHours, setPickupHours] = useState<Record<string, string>>({});

  // Address verification state
  const [addressVerified, setAddressVerified] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Sync local state when settings load
  useEffect(() => {
    if (settings) {
      setLocalPickupAddress(settings.pickup_address ?? '');
      setLocalPickupInstructions(settings.pickup_instructions ?? '');
      setLocalDeliveryRadius(String(settings.delivery_radius_miles ?? 50));
      setLocalDeliveryBaseFee(String(settings.delivery_base_fee ?? 0));
      setLocalDeliveryPerMileFee(String(settings.delivery_per_mile_fee ?? 0));
      setLocalFreeShippingThreshold(settings.free_shipping_threshold ? String(settings.free_shipping_threshold) : '');
      setLocalFlatRateGround(settings.flat_rate_shipping?.ground ? String(settings.flat_rate_shipping.ground) : '');
      setLocalFlatRateExpress(settings.flat_rate_shipping?.express ? String(settings.flat_rate_shipping.express) : '');
      setLocalFlatRateOvernight(settings.flat_rate_shipping?.overnight ? String(settings.flat_rate_shipping.overnight) : '');
      setPickupHours(settings.pickup_hours ?? {});

      // Ship-from address
      if (settings.ships_from_address) {
        setLocalShipName(settings.ships_from_address.name ?? '');
        setLocalShipCompany(settings.ships_from_address.company ?? '');
        setLocalShipStreet1(settings.ships_from_address.street1 ?? '');
        setLocalShipStreet2(settings.ships_from_address.street2 ?? '');
        setLocalShipCity(settings.ships_from_address.city ?? '');
        setLocalShipState(settings.ships_from_address.state ?? '');
        setLocalShipZip(settings.ships_from_address.zip ?? '');
        setLocalShipPhone(settings.ships_from_address.phone ?? '');
        setAddressVerified(settings.ships_from_address_verified ?? false);
      }
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const handleUpdatePickupHours = (day: string, value: string) => {
    const newHours = { ...pickupHours, [day]: value };
    setPickupHours(newHours);
  };

  const savePickupHours = () => {
    updateSettings.mutate({ pickup_hours: pickupHours });
  };

  const handleCarrierToggle = (carrier: ShippingCarrier) => {
    const currentCarriers = settings?.shipping_carriers ?? [];
    const newCarriers = currentCarriers.includes(carrier)
      ? currentCarriers.filter((c) => c !== carrier)
      : [...currentCarriers, carrier];
    updateSettings.mutate({ shipping_carriers: newCarriers });
  };

  const saveShipFromAddress = () => {
    const address: ShippingAddress = {
      name: localShipName,
      company: localShipCompany || undefined,
      street1: localShipStreet1,
      street2: localShipStreet2 || undefined,
      city: localShipCity,
      state: localShipState,
      zip: localShipZip,
      country: 'US',
      phone: localShipPhone || undefined,
    };
    updateSettings.mutate({ ships_from_address: address });
    setAddressVerified(false);
  };

  const handleVerifyAddress = async () => {
    setVerificationError(null);
    const address: ShippingAddress = {
      name: localShipName,
      street1: localShipStreet1,
      street2: localShipStreet2 || undefined,
      city: localShipCity,
      state: localShipState,
      zip: localShipZip,
      country: 'US',
    };

    verifyAddress.mutate(address, {
      onSuccess: (result) => {
        if (result.is_valid) {
          setAddressVerified(true);
          // If there's a suggested address, update the fields
          if (result.suggested_address) {
            setLocalShipStreet1(result.suggested_address.street1);
            setLocalShipStreet2(result.suggested_address.street2 ?? '');
            setLocalShipCity(result.suggested_address.city);
            setLocalShipState(result.suggested_address.state);
            setLocalShipZip(result.suggested_address.zip);
          }
        } else {
          setVerificationError(result.errors?.join(', ') ?? 'Address could not be verified');
        }
      },
      onError: (error: Error) => {
        setVerificationError(error.message);
      },
    });
  };

  const saveFlatRates = () => {
    const flatRates = {
      ground: localFlatRateGround ? parseFloat(localFlatRateGround) : undefined,
      express: localFlatRateExpress ? parseFloat(localFlatRateExpress) : undefined,
      overnight: localFlatRateOvernight ? parseFloat(localFlatRateOvernight) : undefined,
    };
    updateSettings.mutate({ flat_rate_shipping: flatRates });
  };

  return (
    <div className="space-y-6">
      {/* Customer Pickup Section */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="w-4 h-4" />
            Customer Pickup
          </CardTitle>
          <CardDescription>
            Allow renters to pick up equipment at your location
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Allow Customer Pickup</Label>
              <p className="text-sm text-muted-gray">
                Renters can pick up gear in person
              </p>
            </div>
            <Switch
              checked={settings?.allows_customer_pickup ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ allows_customer_pickup: checked })}
            />
          </div>

          {settings?.allows_customer_pickup && (
            <>
              <div>
                <Label>Pickup Address</Label>
                <Input
                  value={localPickupAddress}
                  placeholder="123 Main St, Los Angeles, CA 90001"
                  onChange={(e) => setLocalPickupAddress(e.target.value)}
                  onBlur={() => {
                    if (localPickupAddress !== (settings?.pickup_address ?? '')) {
                      updateSettings.mutate({ pickup_address: localPickupAddress });
                    }
                  }}
                />
                <p className="text-xs text-muted-gray mt-1">
                  Address shown to renters selecting pickup
                </p>
              </div>

              <div>
                <Label>Pickup Instructions</Label>
                <Textarea
                  value={localPickupInstructions}
                  placeholder="Enter through the loading dock. Ring the bell..."
                  rows={2}
                  onChange={(e) => setLocalPickupInstructions(e.target.value)}
                  onBlur={() => {
                    if (localPickupInstructions !== (settings?.pickup_instructions ?? '')) {
                      updateSettings.mutate({ pickup_instructions: localPickupInstructions });
                    }
                  }}
                />
              </div>

              {/* Pickup Hours */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  Pickup Hours
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {WEEKDAYS.map((day) => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-24 text-sm text-muted-gray">{WEEKDAY_LABELS[day]}</span>
                      <Input
                        value={pickupHours[day] ?? ''}
                        placeholder="9am - 5pm"
                        className="flex-1"
                        onChange={(e) => handleUpdatePickupHours(day, e.target.value)}
                        onBlur={savePickupHours}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-gray">
                  Leave blank for days you're closed. Example: "9am - 5pm" or "By appointment"
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Local Delivery Section */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Truck className="w-4 h-4" />
            Local Delivery
          </CardTitle>
          <CardDescription>
            Deliver equipment to renters within your service area
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Local Delivery</Label>
              <p className="text-sm text-muted-gray">
                Deliver gear to nearby renters
              </p>
            </div>
            <Switch
              checked={settings?.local_delivery_enabled ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ local_delivery_enabled: checked })}
            />
          </div>

          {settings?.local_delivery_enabled && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Delivery Radius (miles)</Label>
                <Input
                  type="number"
                  min={0}
                  value={localDeliveryRadius}
                  onChange={(e) => setLocalDeliveryRadius(e.target.value)}
                  onBlur={() => {
                    const value = parseInt(localDeliveryRadius, 10) || 0;
                    if (value !== (settings?.delivery_radius_miles ?? 50)) {
                      updateSettings.mutate({ delivery_radius_miles: value });
                    }
                  }}
                />
              </div>

              <div>
                <Label>Base Fee ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={localDeliveryBaseFee}
                  onChange={(e) => setLocalDeliveryBaseFee(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(localDeliveryBaseFee) || 0;
                    if (value !== (settings?.delivery_base_fee ?? 0)) {
                      updateSettings.mutate({ delivery_base_fee: value });
                    }
                  }}
                />
              </div>

              <div>
                <Label>Per Mile Fee ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={localDeliveryPerMileFee}
                  onChange={(e) => setLocalDeliveryPerMileFee(e.target.value)}
                  onBlur={() => {
                    const value = parseFloat(localDeliveryPerMileFee) || 0;
                    if (value !== (settings?.delivery_per_mile_fee ?? 0)) {
                      updateSettings.mutate({ delivery_per_mile_fee: value });
                    }
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Carrier Shipping Section */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4" />
            Carrier Shipping
          </CardTitle>
          <CardDescription>
            Ship equipment via FedEx, UPS, USPS with label generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Carrier Shipping</Label>
              <p className="text-sm text-muted-gray">
                Ship gear via major carriers with tracking
              </p>
            </div>
            <Switch
              checked={settings?.shipping_enabled ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ shipping_enabled: checked })}
            />
          </div>

          {settings?.shipping_enabled && (
            <>
              {/* Carrier Selection */}
              <div className="space-y-3">
                <Label>Enabled Carriers</Label>
                <div className="flex flex-wrap gap-2">
                  {SHIPPING_CARRIERS.map((carrier) => {
                    const isEnabled = settings?.shipping_carriers?.includes(carrier.value);
                    return (
                      <button
                        key={carrier.value}
                        type="button"
                        onClick={() => handleCarrierToggle(carrier.value)}
                        className={cn(
                          "px-4 py-2 rounded-lg border font-medium transition-colors",
                          isEnabled
                            ? "bg-accent-yellow/20 border-accent-yellow/50 text-accent-yellow"
                            : "bg-charcoal-black/30 border-muted-gray/30 text-muted-gray hover:border-muted-gray/50"
                        )}
                      >
                        {carrier.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ship-From Address */}
              <div className="space-y-4 rounded-lg bg-white/5 p-4">
                <Label className="flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Ship-From Address
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-gray">Contact Name</Label>
                    <Input
                      value={localShipName}
                      placeholder="John Smith"
                      onChange={(e) => setLocalShipName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">Company (Optional)</Label>
                    <Input
                      value={localShipCompany}
                      placeholder="Acme Rentals"
                      onChange={(e) => setLocalShipCompany(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-gray">Street Address</Label>
                  <Input
                    value={localShipStreet1}
                    placeholder="123 Main Street"
                    onChange={(e) => setLocalShipStreet1(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-gray">Suite/Unit (Optional)</Label>
                  <Input
                    value={localShipStreet2}
                    placeholder="Suite 100"
                    onChange={(e) => setLocalShipStreet2(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs text-muted-gray">City</Label>
                    <Input
                      value={localShipCity}
                      placeholder="Los Angeles"
                      onChange={(e) => setLocalShipCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">State</Label>
                    <Input
                      value={localShipState}
                      placeholder="CA"
                      maxLength={2}
                      onChange={(e) => setLocalShipState(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-gray">ZIP Code</Label>
                    <Input
                      value={localShipZip}
                      placeholder="90001"
                      onChange={(e) => setLocalShipZip(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-gray">Phone (Optional)</Label>
                  <Input
                    value={localShipPhone}
                    placeholder="(555) 123-4567"
                    onChange={(e) => setLocalShipPhone(e.target.value)}
                  />
                </div>

                {/* Address Verification Status */}
                {addressVerified && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Address verified
                  </div>
                )}
                {verificationError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    {verificationError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyAddress}
                    disabled={verifyAddress.isPending || !localShipStreet1 || !localShipCity || !localShipState || !localShipZip}
                  >
                    {verifyAddress.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Verify Address
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveShipFromAddress}
                    disabled={updateSettings.isPending || !localShipName || !localShipStreet1 || !localShipCity || !localShipState || !localShipZip}
                  >
                    {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Address
                  </Button>
                </div>
              </div>

              {/* Pricing Mode */}
              <div className="space-y-3">
                <Label>Shipping Pricing Mode</Label>
                <Select
                  value={settings?.shipping_pricing_mode ?? 'real_time'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ shipping_pricing_mode: value as ShippingPricingMode })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICING_MODE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-gray">
                  {PRICING_MODE_OPTIONS.find((o) => o.value === settings?.shipping_pricing_mode)?.description}
                </p>
              </div>

              {/* Flat Rate Options */}
              {(settings?.shipping_pricing_mode === 'flat_rate' || settings?.shipping_pricing_mode === 'both') && (
                <div className="space-y-4 rounded-lg bg-white/5 p-4">
                  <Label>Flat Rate Prices</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-gray">Ground ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={localFlatRateGround}
                        placeholder="15.00"
                        onChange={(e) => setLocalFlatRateGround(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-gray">Express ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={localFlatRateExpress}
                        placeholder="35.00"
                        onChange={(e) => setLocalFlatRateExpress(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-gray">Overnight ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={localFlatRateOvernight}
                        placeholder="75.00"
                        onChange={(e) => setLocalFlatRateOvernight(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={saveFlatRates}>
                    Save Flat Rates
                  </Button>
                </div>
              )}

              {/* Free Shipping Threshold */}
              <div className="w-64">
                <Label>Free Shipping Threshold ($)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={localFreeShippingThreshold}
                  placeholder="500.00"
                  onChange={(e) => setLocalFreeShippingThreshold(e.target.value)}
                  onBlur={() => {
                    const value = localFreeShippingThreshold ? parseFloat(localFreeShippingThreshold) : null;
                    if (value !== (settings?.free_shipping_threshold ?? null)) {
                      updateSettings.mutate({ free_shipping_threshold: value ?? undefined });
                    }
                  }}
                />
                <p className="text-xs text-muted-gray mt-1">
                  Orders over this amount qualify for free shipping. Leave blank to disable.
                </p>
              </div>

              {/* Return Shipping Policy */}
              <div className="space-y-3">
                <Label>Return Shipping</Label>
                <Select
                  value={settings?.return_shipping_paid_by ?? 'renter'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ return_shipping_paid_by: value as 'renter' | 'rental_house' })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="renter">Renter pays return shipping</SelectItem>
                    <SelectItem value="rental_house">We provide prepaid return label</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-gray">
                  {settings?.return_shipping_paid_by === 'rental_house'
                    ? 'You will be charged for return labels when generated'
                    : 'Renters are responsible for return shipping costs'}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// VERIFICATION SETTINGS
// ============================================================================

function VerificationSettings({ orgId }: { orgId: string }) {
  const { settings, isLoading, updateSettings } = useGearOrgSettings(orgId);

  // Local state for number inputs (saves on blur)
  const [localLateFee, setLocalLateFee] = useState('0');
  const [localGracePeriod, setLocalGracePeriod] = useState('0');

  // Sync local state when settings load
  useEffect(() => {
    if (settings) {
      setLocalLateFee(String(settings.late_fee_per_day ?? 0));
      setLocalGracePeriod(String(settings.late_grace_period_hours ?? 0));
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Checkout Verification */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Checkout Verification
          </CardTitle>
          <CardDescription>
            Require verification when checking out equipment to team members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Verification</Label>
              <p className="text-sm text-muted-gray">
                Require item-by-item verification before completing checkout
              </p>
            </div>
            <Switch
              checked={settings?.team_checkout_verification_required ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ team_checkout_verification_required: checked })}
            />
          </div>

          {settings?.team_checkout_verification_required && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Verification Method</Label>
                  <Select
                    value={settings?.team_checkout_verify_method ?? 'scan_or_checkoff'}
                    onValueChange={(value) =>
                      updateSettings.mutate({ team_checkout_verify_method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scan_only">Scan Only (Barcode/QR)</SelectItem>
                      <SelectItem value="scan_or_checkoff">Scan or Manual Check-off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>On Discrepancy</Label>
                  <Select
                    value={settings?.team_checkout_discrepancy_action ?? 'warn'}
                    onValueChange={(value) =>
                      updateSettings.mutate({ team_checkout_discrepancy_action: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block Checkout</SelectItem>
                      <SelectItem value="warn">Warn and Allow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Kit Verification</Label>
                <Select
                  value={settings?.team_checkout_kit_verification ?? 'kit_only'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ team_checkout_kit_verification: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kit_only">Verify Kit as Unit</SelectItem>
                    <SelectItem value="verify_contents">Verify Each Item in Kit</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray mt-1">
                  Choose whether to verify the kit as one item or each item inside
                </p>
              </div>

              <div>
                <Label>Equipment Package Verification</Label>
                <Select
                  value={settings?.team_checkout_package_verification ?? 'package_only'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ team_checkout_package_verification: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package_only">Verify Package as Unit</SelectItem>
                    <SelectItem value="verify_contents">Verify Each Accessory</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-gray mt-1">
                  Choose whether to verify equipment packages as one item or each accessory
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Client Rental Verification */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Client Rental Verification
          </CardTitle>
          <CardDescription>
            Require verification when renting equipment to external clients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Verification</Label>
              <p className="text-sm text-muted-gray">
                Require item-by-item verification before completing rental
              </p>
            </div>
            <Switch
              checked={settings?.client_checkout_verification_required ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ client_checkout_verification_required: checked })}
            />
          </div>

          {settings?.client_checkout_verification_required && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Verification Method</Label>
                  <Select
                    value={settings?.client_checkout_verify_method ?? 'scan_or_checkoff'}
                    onValueChange={(value) =>
                      updateSettings.mutate({ client_checkout_verify_method: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scan_only">Scan Only (Barcode/QR)</SelectItem>
                      <SelectItem value="scan_or_checkoff">Scan or Manual Check-off</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>On Discrepancy</Label>
                  <Select
                    value={settings?.client_checkout_discrepancy_action ?? 'warn'}
                    onValueChange={(value) =>
                      updateSettings.mutate({ client_checkout_discrepancy_action: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="block">Block Checkout</SelectItem>
                      <SelectItem value="warn">Warn and Allow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Kit Verification</Label>
                <Select
                  value={settings?.client_checkout_kit_verification ?? 'kit_only'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ client_checkout_kit_verification: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kit_only">Verify Kit as Unit</SelectItem>
                    <SelectItem value="verify_contents">Verify Each Item in Kit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Equipment Package Verification</Label>
                <Select
                  value={settings?.client_checkout_package_verification ?? 'package_only'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ client_checkout_package_verification: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package_only">Verify Package as Unit</SelectItem>
                    <SelectItem value="verify_contents">Verify Each Accessory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Receiver Verification */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Receiver Verification</CardTitle>
          <CardDescription>
            Require the person receiving equipment to verify receipt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Verification Mode</Label>
            <Select
              value={settings?.receiver_verification_mode ?? 'none'}
              onValueChange={(value) =>
                updateSettings.mutate({ receiver_verification_mode: value })
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not Required</SelectItem>
                <SelectItem value="signature">Signature Only</SelectItem>
                <SelectItem value="scan">Scan Items</SelectItem>
                <SelectItem value="signature_and_scan">Signature + Scan Items</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              How should the receiver confirm receipt of equipment?
            </p>
          </div>

          {settings?.receiver_verification_mode && settings?.receiver_verification_mode !== 'none' && (
            <div>
              <Label>Verification Timing</Label>
              <Select
                value={settings?.receiver_verification_timing ?? 'same_session'}
                onValueChange={(value) =>
                  updateSettings.mutate({ receiver_verification_timing: value })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="same_session">Same Session (In-Person)</SelectItem>
                  <SelectItem value="async_link">Send Verification Link</SelectItem>
                  <SelectItem value="both">Either Option</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-gray mt-1">
                Async links allow receiver to verify remotely via email/SMS
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Check-in Verification */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Check-in Verification</CardTitle>
          <CardDescription>
            Require verification when equipment is returned
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Require Verification</Label>
              <p className="text-sm text-muted-gray">
                Require item-by-item verification when checking in returns
              </p>
            </div>
            <Switch
              checked={settings?.checkin_verification_required ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ checkin_verification_required: checked })}
            />
          </div>

          {settings?.checkin_verification_required && (
            <>
              <div>
                <Label>Verification Method</Label>
                <Select
                  value={settings?.checkin_verify_method ?? 'scan_or_checkoff'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ checkin_verify_method: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scan_only">Scan Only (Barcode/QR)</SelectItem>
                    <SelectItem value="scan_or_checkoff">Scan or Manual Check-off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Kit Verification</Label>
                <Select
                  value={settings?.checkin_kit_verification ?? 'kit_only'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ checkin_kit_verification: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kit_only">Verify Kit as Unit</SelectItem>
                    <SelectItem value="verify_contents">Verify Each Item in Kit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Equipment Package Verification</Label>
                <Select
                  value={settings?.checkin_package_verification ?? 'package_only'}
                  onValueChange={(value) =>
                    updateSettings.mutate({ checkin_package_verification: value })
                  }
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="package_only">Verify Package as Unit</SelectItem>
                    <SelectItem value="verify_contents">Verify Each Accessory</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Check-in Permissions & Policies */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Check-in Permissions & Policies</CardTitle>
          <CardDescription>
            Control who can process returns and how partial returns are handled
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Who Can Process Returns</Label>
            <Select
              value={settings?.checkin_permission_level ?? 'anyone'}
              onValueChange={(value) =>
                updateSettings.mutate({ checkin_permission_level: value })
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anyone">Anyone with access</SelectItem>
                <SelectItem value="custodian_only">Custodian only</SelectItem>
                <SelectItem value="custodian_and_admins">Custodian + Admins/Managers</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              Who is allowed to process check-ins for items?
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Require Condition Assessment</Label>
              <p className="text-sm text-muted-gray">
                Require condition rating for each returned item
              </p>
            </div>
            <Switch
              checked={settings?.require_condition_on_checkin ?? false}
              onCheckedChange={(checked) => updateSettings.mutate({ require_condition_on_checkin: checked })}
            />
          </div>

          <div>
            <Label>Partial Return Policy</Label>
            <Select
              value={settings?.partial_return_policy ?? 'allow'}
              onValueChange={(value) =>
                updateSettings.mutate({ partial_return_policy: value })
              }
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="allow">Allow partial returns</SelectItem>
                <SelectItem value="warn">Warn but allow</SelectItem>
                <SelectItem value="block">Block partial returns</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              What happens when not all items are returned?
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Late Return Settings */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Late Return Settings</CardTitle>
          <CardDescription>
            Configure late fees and automatic incident creation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Late Fee Per Day ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={localLateFee}
                className="w-32"
                onChange={(e) => setLocalLateFee(e.target.value)}
                onBlur={() => {
                  const value = parseFloat(localLateFee) || 0;
                  if (value !== (settings?.late_fee_per_day ?? 0)) {
                    updateSettings.mutate({ late_fee_per_day: value });
                  }
                }}
              />
              <p className="text-xs text-muted-gray mt-1">
                Set to 0 for no late fees
              </p>
            </div>

            <div>
              <Label>Grace Period (hours)</Label>
              <Input
                type="number"
                min="0"
                value={localGracePeriod}
                className="w-32"
                onChange={(e) => setLocalGracePeriod(e.target.value)}
                onBlur={() => {
                  const value = parseInt(localGracePeriod, 10) || 0;
                  if (value !== (settings?.late_grace_period_hours ?? 0)) {
                    updateSettings.mutate({ late_grace_period_hours: value });
                  }
                }}
              />
              <p className="text-xs text-muted-gray mt-1">
                Hours before late fees apply
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-create Late Return Incident</Label>
              <p className="text-sm text-muted-gray">
                Automatically log an incident when items are returned late
              </p>
            </div>
            <Switch
              checked={settings?.late_return_auto_incident ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ late_return_auto_incident: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Check-in Notifications */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base">Check-in Notifications</CardTitle>
          <CardDescription>
            Configure notifications for check-in events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Notify on check-in completion</span>
            <Switch
              checked={settings?.notify_on_checkin ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ notify_on_checkin: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Notify on late returns</span>
            <Switch
              checked={settings?.notify_late_return ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ notify_late_return: checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Notify when damage is reported</span>
            <Switch
              checked={settings?.notify_damage_found ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ notify_damage_found: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Work Order Staging */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            Work Order Staging
          </CardTitle>
          <CardDescription>
            Configure how items are verified when staging work orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Staging Verification Method</Label>
            <Select
              value={settings?.work_order_staging_verify_method ?? 'checkoff_only'}
              onValueChange={(value) =>
                updateSettings.mutate({ work_order_staging_verify_method: value })
              }
            >
              <SelectTrigger className="w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checkoff_only">Checkoff Only (Simple checkbox)</SelectItem>
                <SelectItem value="barcode_required">Barcode Scan Required</SelectItem>
                <SelectItem value="qr_required">QR Code Scan Required</SelectItem>
                <SelectItem value="scan_or_checkoff">Scan or Checkoff (Either method)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-gray mt-1">
              Choose how preparers verify items when staging work orders
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-mark as Ready</Label>
              <p className="text-sm text-muted-gray">
                Automatically transition to Ready status when all items are staged
              </p>
            </div>
            <Switch
              checked={settings?.work_order_auto_ready ?? true}
              onCheckedChange={(checked) => updateSettings.mutate({ work_order_auto_ready: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// MEMBERS SETTINGS
// ============================================================================

function MembersSettings({ orgId }: { orgId: string }) {
  const { members, isLoading, addMember, updateMemberRole, removeMember } = useGearOrgMembers(orgId);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-bone-white">Organization Members</h3>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <Table>
          <TableHeader>
            <TableRow className="border-muted-gray/30 hover:bg-transparent">
              <TableHead>Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                onUpdateRole={(role) =>
                  updateMemberRole.mutate({ memberId: member.id, role })
                }
                onRemove={() => {
                  if (confirm('Remove this member?')) {
                    removeMember.mutate(member.id);
                  }
                }}
              />
            ))}
          </TableBody>
        </Table>
      </Card>

      <AddMemberModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={async (data) => {
          await addMember.mutateAsync(data);
          setIsAddModalOpen(false);
        }}
        isSubmitting={addMember.isPending}
      />
    </div>
  );
}

function MemberRow({
  member,
  onUpdateRole,
  onRemove,
}: {
  member: GearOrganizationMember;
  onUpdateRole: (role: string) => void;
  onRemove: () => void;
}) {
  const roleConfig = ROLE_CONFIG[member.role];

  return (
    <TableRow className="border-muted-gray/30 hover:bg-charcoal-black/30">
      <TableCell>
        <div className="flex items-center gap-3">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted-gray/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-muted-gray" />
            </div>
          )}
          <span className="text-bone-white">{member.display_name || 'Unknown'}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-gray">{member.email || '—'}</span>
      </TableCell>
      <TableCell>
        <Select value={member.role} onValueChange={onUpdateRole} disabled={member.role === 'owner'}>
          <SelectTrigger className="w-32">
            <Badge className={cn('border', roleConfig.color)}>{roleConfig.label}</Badge>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROLE_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        {member.is_active ? (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 border">Active</Badge>
        ) : (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 border">
            Pending
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {member.role !== 'owner' && (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <Trash2 className="w-4 h-4 text-muted-gray hover:text-red-400" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function AddMemberModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { user_id: string; role: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<OrganizationMemberRole>('member');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    await onSubmit({ user_id: userId, role });
    setUserId('');
    setRole('member');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Member</DialogTitle>
          <DialogDescription>Add a new member to this organization</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>User ID</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as OrganizationMemberRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_CONFIG)
                  .filter(([v]) => v !== 'owner')
                  .map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !userId}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Member
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CATEGORIES SETTINGS
// ============================================================================

function CategoriesSettings({ orgId }: { orgId: string }) {
  const { categories, isLoading, createCategory } = useGearCategories(orgId);
  const [newCategoryName, setNewCategoryName] = useState('');

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await createCategory.mutateAsync({ name: newCategoryName.trim() });
    setNewCategoryName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New category name"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
        />
        <Button onClick={handleAddCategory} disabled={createCategory.isPending}>
          {createCategory.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => (
          <Card key={cat.id} className="bg-charcoal-black/50 border-muted-gray/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-accent-yellow" />
                  <span className="text-bone-white">{cat.name}</span>
                </div>
                {cat.requires_certification && (
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 border">
                    <Shield className="w-3 h-3 mr-1" />
                    Cert
                  </Badge>
                )}
              </div>
              {cat.description && (
                <p className="text-sm text-muted-gray mt-2">{cat.description}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LOCATIONS SETTINGS
// ============================================================================

function LocationsSettings({ orgId }: { orgId: string }) {
  const { locations, isLoading, createLocation } = useGearLocations(orgId);
  const [newLocationName, setNewLocationName] = useState('');

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    await createLocation.mutateAsync({ name: newLocationName.trim(), location_type: 'warehouse' });
    setNewLocationName('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="New location name"
          value={newLocationName}
          onChange={(e) => setNewLocationName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
        />
        <Button onClick={handleAddLocation} disabled={createLocation.isPending}>
          {createLocation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          <Plus className="w-4 h-4 mr-2" />
          Add
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((loc) => (
          <Card key={loc.id} className="bg-charcoal-black/50 border-muted-gray/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-accent-yellow" />
                <span className="text-bone-white">{loc.name}</span>
              </div>
              <p className="text-sm text-muted-gray mt-1 capitalize">
                {loc.location_type.replace('_', ' ')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// LOCATION SETTINGS CARD
// ============================================================================

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

function LocationSettingsCard({ orgId, organization }: { orgId: string; organization: GearOrganization }) {
  const { settings, isLoading, updateSettings } = useMarketplaceSettings(orgId);
  const { updatePrivacy } = useUpdateLocationPrivacy();

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Local address state
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [hideExactAddress, setHideExactAddress] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Sync with settings when loaded
  useEffect(() => {
    if (settings) {
      setAddressLine1(settings.address_line1 || '');
      setCity(settings.city || '');
      setState(settings.state || '');
      setPostalCode(settings.postal_code || '');
      setHideExactAddress(settings.hide_exact_address || false);
    }
  }, [settings]);

  const handleSave = async () => {
    // Validate
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
    setIsSaving(true);

    try {
      // Geocode the new address using AWS Location Service via API
      const fullAddress = `${addressLine1}, ${city}, ${state} ${postalCode}, US`;
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE}/api/v1/gear/marketplace/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ address: fullAddress }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.detail || 'Could not find that address. Please check and try again.');
        setIsSaving(false);
        return;
      }

      const data = await response.json();
      const latitude = data.latitude;
      const longitude = data.longitude;

      // Update marketplace settings with new location
      await updateSettings.mutateAsync({
        address_line1: addressLine1.trim(),
        city: city.trim(),
        state: state,
        postal_code: postalCode.trim(),
        country: 'US',
        location_latitude: latitude,
        location_longitude: longitude,
        public_location_display: hideExactAddress ? `${city}, ${state}` : `${addressLine1}, ${city}, ${state}`,
        hide_exact_address: hideExactAddress,
      });

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save location');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to saved values
    if (settings) {
      setAddressLine1(settings.address_line1 || '');
      setCity(settings.city || '');
      setState(settings.state || '');
      setPostalCode(settings.postal_code || '');
      setHideExactAddress(settings.hide_exact_address || false);
    }
    setError(null);
    setIsEditing(false);
  };

  const handlePrivacyToggle = async (checked: boolean) => {
    setHideExactAddress(checked);

    // If not editing, update immediately
    if (!isEditing && settings) {
      const publicDisplay = checked
        ? `${settings.city || city}, ${settings.state || state}`
        : `${settings.address_line1 || addressLine1}, ${settings.city || city}, ${settings.state || state}`;

      await updatePrivacy.updatePrivacy.mutateAsync({
        orgId,
        hideExactAddress: checked,
        publicDisplay,
      });
    }
  };

  if (isLoading) {
    return <Skeleton className="h-64" />;
  }

  const hasLocation = settings?.location_latitude && settings?.location_longitude;
  const displayAddress = settings?.hide_exact_address
    ? `${settings?.city || ''}, ${settings?.state || ''}`
    : settings?.public_location_display || 'No location set';

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent-yellow" />
              Location
            </CardTitle>
            <CardDescription>Your gear house location for marketplace search</CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEditing ? (
          // Editing Mode
          <>
            <div>
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="123 Main Street"
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

            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/30 p-3">
                <p className="text-sm text-red-500">{error}</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Location
              </Button>
            </div>
          </>
        ) : (
          // Display Mode
          <>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-bone-white font-medium">{displayAddress}</p>
                {hasLocation && (
                  <p className="text-xs text-muted-gray mt-1">
                    Coordinates: {settings?.location_latitude?.toFixed(4)}, {settings?.location_longitude?.toFixed(4)}
                  </p>
                )}
              </div>
              {hasLocation && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Verified
                </Badge>
              )}
            </div>

            {/* Privacy Toggle (quick access) */}
            <div className="flex items-center justify-between py-2 px-3 bg-charcoal-black/50 rounded-lg border border-muted-gray/20">
              <div className="flex items-center gap-2">
                {settings?.hide_exact_address ? (
                  <EyeOff className="w-4 h-4 text-muted-gray" />
                ) : (
                  <Eye className="w-4 h-4 text-accent-yellow" />
                )}
                <div>
                  <p className="text-sm text-bone-white">Address privacy</p>
                  <p className="text-xs text-muted-gray">
                    {settings?.hide_exact_address
                      ? 'Only city and state shown in marketplace'
                      : 'Full address visible in marketplace'}
                  </p>
                </div>
              </div>
              <Switch
                checked={settings?.hide_exact_address || false}
                onCheckedChange={handlePrivacyToggle}
                disabled={updatePrivacy.isPending}
              />
            </div>

            {!hasLocation && (
              <div className="flex items-center gap-2 text-amber-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>No location set. Add an address to appear in marketplace search.</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
