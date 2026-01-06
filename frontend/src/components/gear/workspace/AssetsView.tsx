/**
 * Assets View
 * Main view for managing gear assets within an organization
 */
import React, { useState } from 'react';
import {
  Box,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  QrCode,
  History,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wrench,
  XCircle,
  Loader2,
  ScanLine,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

import {
  useGearAssets,
  useGearAsset,
  useGearCategories,
  useGearLocations,
  useGearScanLookup,
  useGearAssetStats,
} from '@/hooks/gear';
import type {
  GearAsset,
  AssetStatus,
  AssetCondition,
  AssetType,
  CreateAssetInput,
} from '@/types/gear';
import { cn } from '@/lib/utils';

// ============================================================================
// STATUS & CONDITION CONFIG
// ============================================================================

const STATUS_CONFIG: Record<AssetStatus, { label: string; color: string; icon: React.ReactNode }> = {
  available: {
    label: 'Available',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  reserved: {
    label: 'Reserved',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  checked_out: {
    label: 'Checked Out',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <Package className="w-3 h-3" />,
  },
  in_transit: {
    label: 'In Transit',
    color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    icon: <Package className="w-3 h-3" />,
  },
  quarantined: {
    label: 'Quarantined',
    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  under_repair: {
    label: 'Under Repair',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Wrench className="w-3 h-3" />,
  },
  retired: {
    label: 'Retired',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
  lost: {
    label: 'Lost',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const CONDITION_CONFIG: Record<AssetCondition, { label: string; color: string }> = {
  excellent: { label: 'Excellent', color: 'text-green-400' },
  good: { label: 'Good', color: 'text-blue-400' },
  fair: { label: 'Fair', color: 'text-yellow-400' },
  poor: { label: 'Poor', color: 'text-orange-400' },
  non_functional: { label: 'Non-Functional', color: 'text-red-400' },
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  serialized: 'Serialized',
  consumable: 'Consumable',
  expendable: 'Expendable',
  component: 'Component',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

interface AssetsViewProps {
  orgId: string;
}

export function AssetsView({ orgId }: AssetsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const { categories } = useGearCategories(orgId);
  const { assets, isLoading, createAsset } = useGearAssets({
    orgId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    search: searchTerm || undefined,
  });
  const { data: stats } = useGearAssetStats(orgId);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Assets"
          value={stats?.total ?? 0}
          icon={<Box className="w-5 h-5" />}
        />
        <StatCard
          label="Available"
          value={stats?.by_status?.available ?? 0}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color="text-green-400"
        />
        <StatCard
          label="Checked Out"
          value={stats?.by_status?.checked_out ?? 0}
          icon={<Package className="w-5 h-5" />}
          color="text-purple-400"
        />
        <StatCard
          label="Under Repair"
          value={stats?.by_status?.under_repair ?? 0}
          icon={<Wrench className="w-5 h-5" />}
          color="text-yellow-400"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AssetStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setIsScanModalOpen(true)}>
          <ScanLine className="w-4 h-4 mr-2" />
          Scan
        </Button>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Asset
        </Button>
      </div>

      {/* Assets Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Box className="w-12 h-12 text-muted-gray mb-4" />
            <h3 className="text-lg font-semibold text-bone-white mb-2">No Assets Found</h3>
            <p className="text-muted-gray text-center mb-4">
              {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Add your first asset to get started'}
            </p>
            {!searchTerm && statusFilter === 'all' && categoryFilter === 'all' && (
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Asset
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/30 hover:bg-transparent">
                <TableHead>Asset</TableHead>
                <TableHead>Internal ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Location / Custodian</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assets.map((asset) => (
                <AssetRow
                  key={asset.id}
                  asset={asset}
                  onView={() => setSelectedAssetId(asset.id)}
                />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Asset Modal */}
      <CreateAssetModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        orgId={orgId}
        categories={categories}
        onSubmit={async (data) => {
          await createAsset.mutateAsync(data);
          setIsCreateModalOpen(false);
        }}
        isSubmitting={createAsset.isPending}
      />

      {/* Asset Detail Modal */}
      <AssetDetailModal
        assetId={selectedAssetId}
        onClose={() => setSelectedAssetId(null)}
      />

      {/* Scan Modal */}
      <ScanLookupModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        orgId={orgId}
        onAssetFound={(asset) => {
          setIsScanModalOpen(false);
          setSelectedAssetId(asset.id);
        }}
      />
    </div>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-gray">{label}</p>
            <p className={cn('text-2xl font-bold', color || 'text-bone-white')}>{value}</p>
          </div>
          <div className={cn('p-2 rounded-lg bg-muted-gray/20', color)}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ASSET ROW
// ============================================================================

interface AssetRowProps {
  asset: GearAsset;
  onView: () => void;
}

function AssetRow({ asset, onView }: AssetRowProps) {
  const statusConfig = STATUS_CONFIG[asset.status];
  const conditionConfig = CONDITION_CONFIG[asset.condition];

  return (
    <TableRow className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer" onClick={onView}>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted-gray/20 flex items-center justify-center">
            <Box className="w-5 h-5 text-muted-gray" />
          </div>
          <div>
            <p className="font-medium text-bone-white">{asset.name}</p>
            {asset.manufacturer && (
              <p className="text-sm text-muted-gray">
                {asset.manufacturer} {asset.model && `• ${asset.model}`}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <code className="text-sm bg-muted-gray/20 px-2 py-1 rounded">{asset.internal_id}</code>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-gray">{asset.category_name || '—'}</span>
      </TableCell>
      <TableCell>
        <Badge className={cn('border', statusConfig.color)}>
          {statusConfig.icon}
          <span className="ml-1">{statusConfig.label}</span>
        </Badge>
      </TableCell>
      <TableCell>
        <span className={cn('text-sm', conditionConfig.color)}>{conditionConfig.label}</span>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-gray">
          {asset.current_custodian_name || asset.current_location_name || '—'}
        </span>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onView}>
              <Edit className="w-4 h-4 mr-2" /> View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <QrCode className="w-4 h-4 mr-2" /> Print Label
            </DropdownMenuItem>
            <DropdownMenuItem>
              <History className="w-4 h-4 mr-2" /> View History
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// CREATE ASSET MODAL
// ============================================================================

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  categories: Array<{ id: string; name: string }>;
  onSubmit: (data: CreateAssetInput) => Promise<void>;
  isSubmitting: boolean;
}

function CreateAssetModal({
  isOpen,
  onClose,
  orgId,
  categories,
  onSubmit,
  isSubmitting,
}: CreateAssetModalProps) {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [assetType, setAssetType] = useState<AssetType>('serialized');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { locations } = useGearLocations(orgId);
  const [homeLocationId, setHomeLocationId] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Asset name is required');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        category_id: categoryId || undefined,
        asset_type: assetType,
        manufacturer: manufacturer.trim() || undefined,
        model: model.trim() || undefined,
        serial_number: serialNumber.trim() || undefined,
        description: description.trim() || undefined,
        home_location_id: homeLocationId || undefined,
      });
      // Reset form
      setName('');
      setCategoryId('');
      setAssetType('serialized');
      setManufacturer('');
      setModel('');
      setSerialNumber('');
      setDescription('');
      setHomeLocationId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add New Asset</DialogTitle>
          <DialogDescription>Add a new piece of equipment to your inventory</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Asset Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Canon C300 Mark III"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type">Asset Type</Label>
              <Select value={assetType} onValueChange={(v) => setAssetType(v as AssetType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSET_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Canon"
              />
            </div>

            <div>
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., C300 Mark III"
              />
            </div>

            <div>
              <Label htmlFor="serial">Serial Number</Label>
              <Input
                id="serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="e.g., ABC123456"
              />
            </div>

            <div>
              <Label htmlFor="location">Home Location</Label>
              <Select value={homeLocationId} onValueChange={setHomeLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((loc) => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this asset"
                rows={2}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Asset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// ASSET DETAIL MODAL
// ============================================================================

interface AssetDetailModalProps {
  assetId: string | null;
  onClose: () => void;
}

function AssetDetailModal({ assetId, onClose }: AssetDetailModalProps) {
  const { asset, isLoading } = useGearAsset(assetId);

  if (!assetId) return null;

  return (
    <Dialog open={!!assetId} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{asset?.name || 'Loading...'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : asset ? (
            <div className="space-y-6">
              {/* Status & Condition */}
              <div className="flex items-center gap-4">
                <Badge className={cn('border', STATUS_CONFIG[asset.status].color)}>
                  {STATUS_CONFIG[asset.status].icon}
                  <span className="ml-1">{STATUS_CONFIG[asset.status].label}</span>
                </Badge>
                <span className={cn('text-sm', CONDITION_CONFIG[asset.condition].color)}>
                  {CONDITION_CONFIG[asset.condition].label} condition
                </span>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Internal ID" value={asset.internal_id} mono />
                <DetailItem label="Category" value={asset.category_name} />
                <DetailItem label="Manufacturer" value={asset.manufacturer} />
                <DetailItem label="Model" value={asset.model} />
                <DetailItem label="Serial Number" value={asset.serial_number} mono />
                <DetailItem label="Asset Type" value={ASSET_TYPE_LABELS[asset.asset_type]} />
                <DetailItem label="Current Location" value={asset.current_location_name} />
                <DetailItem label="Current Custodian" value={asset.current_custodian_name} />
                {asset.barcode && <DetailItem label="Barcode" value={asset.barcode} mono />}
                {asset.purchase_price && (
                  <DetailItem
                    label="Purchase Price"
                    value={`$${asset.purchase_price.toLocaleString()}`}
                  />
                )}
                {asset.replacement_value && (
                  <DetailItem
                    label="Replacement Value"
                    value={`$${asset.replacement_value.toLocaleString()}`}
                  />
                )}
              </div>

              {/* Description */}
              {asset.description && (
                <div>
                  <Label className="text-muted-gray">Description</Label>
                  <p className="text-bone-white mt-1">{asset.description}</p>
                </div>
              )}

              {/* Notes */}
              {asset.notes && (
                <div>
                  <Label className="text-muted-gray">Notes</Label>
                  <p className="text-bone-white mt-1">{asset.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-gray">Asset not found</p>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button>
            <Edit className="w-4 h-4 mr-2" />
            Edit Asset
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <Label className="text-muted-gray text-xs">{label}</Label>
      <p className={cn('text-bone-white', mono && 'font-mono text-sm')}>{value || '—'}</p>
    </div>
  );
}

// ============================================================================
// SCAN LOOKUP MODAL
// ============================================================================

interface ScanLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onAssetFound: (asset: GearAsset) => void;
}

function ScanLookupModal({ isOpen, onClose, orgId, onAssetFound }: ScanLookupModalProps) {
  const [scanCode, setScanCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { lookupAsset } = useGearScanLookup(orgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanCode.trim()) return;

    setError(null);
    try {
      const result = await lookupAsset.mutateAsync(scanCode.trim());
      if (result.asset) {
        onAssetFound(result.asset);
        setScanCode('');
      } else {
        setError('Asset not found');
      }
    } catch {
      setError('Asset not found');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Asset</DialogTitle>
          <DialogDescription>
            Scan a barcode or QR code, or enter the asset ID manually
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="scanCode">Barcode / QR Code / Asset ID</Label>
            <Input
              id="scanCode"
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              placeholder="Scan or type here..."
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={lookupAsset.isPending}>
              {lookupAsset.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lookup
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
