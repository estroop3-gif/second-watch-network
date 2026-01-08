/**
 * Assets View
 * Main view for managing gear assets within an organization
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
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
  MapPin,
  Check,
  Barcode,
  Printer,
  RefreshCw,
  ExternalLink,
  ListPlus,
  Store,
  Camera,
  Upload,
  X,
  ImagePlus,
  ChevronDown,
  ChevronRight,
  Link,
  Unlink,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  useGearAssets,
  useGearAsset,
  useGearCategories,
  useGearLocations,
  useGearScanLookup,
  useGearAssetStats,
  useGearLabels,
  useGearPrintQueue,
} from '@/hooks/gear';
import type {
  GearAsset,
  AssetStatus,
  AssetCondition,
  AssetType,
  CreateAssetInput,
} from '@/types/gear';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BatchPrintModal } from './BatchPrintModal';
import { CreateListingDialog } from '../marketplace/CreateListingDialog';

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
// AUTHENTICATED IMAGE COMPONENT
// ============================================================================

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
}

function AuthenticatedImage({ src, alt, className }: AuthenticatedImageProps) {
  const { session } = useAuth();
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session?.access_token || !src) return;

    const fetchImage = async () => {
      setIsLoading(true);
      setError(false);
      try {
        const response = await fetch(src, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch image');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setImageSrc(url);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImage();

    // Cleanup
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src, session?.access_token]);

  if (isLoading) {
    return <Skeleton className={className} />;
  }

  if (error || !imageSrc) {
    return (
      <div className={cn('flex items-center justify-center bg-gray-100 text-gray-400', className)}>
        <AlertCircle className="w-6 h-6" />
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} className={className} />;
}

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

  // Multi-select state for batch operations
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [queueAddedCount, setQueueAddedCount] = useState<number | null>(null);

  // Marketplace listing state
  const [isListingDialogOpen, setIsListingDialogOpen] = useState(false);
  const [assetToList, setAssetToList] = useState<GearAsset | null>(null);
  const [assetsToList, setAssetsToList] = useState<GearAsset[]>([]);

  // Equipment Package state
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [convertingAssetId, setConvertingAssetId] = useState<string | null>(null);

  const { categories } = useGearCategories(orgId);
  const { addToQueue } = useGearPrintQueue(orgId);
  const { assets, isLoading, createAsset, refetch: refetchAssets } = useGearAssets({
    orgId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    search: searchTerm || undefined,
    parentAssetId: 'none', // Only show root assets
    includeAccessoryCount: true, // Include accessory count for each asset
  });
  const { data: stats } = useGearAssetStats(orgId);

  // Toggle expanded state for equipment packages
  const toggleExpanded = (assetId: string) => {
    const newExpanded = new Set(expandedAssets);
    if (newExpanded.has(assetId)) {
      newExpanded.delete(assetId);
    } else {
      newExpanded.add(assetId);
    }
    setExpandedAssets(newExpanded);
  };

  // Selection handlers for batch operations
  const toggleAsset = (assetId: string) => {
    const newSelected = new Set(selectedAssets);
    if (newSelected.has(assetId)) {
      newSelected.delete(assetId);
    } else {
      newSelected.add(assetId);
    }
    setSelectedAssets(newSelected);
  };

  const toggleAll = () => {
    if (selectedAssets.size === assets.length && assets.length > 0) {
      setSelectedAssets(new Set());
    } else {
      setSelectedAssets(new Set(assets.map((a) => a.id)));
    }
  };

  const clearSelection = () => {
    setSelectedAssets(new Set());
  };

  const handleAddToQueue = async () => {
    if (selectedAssets.size === 0) return;
    try {
      await addToQueue.mutateAsync({
        asset_ids: Array.from(selectedAssets),
      });
      setQueueAddedCount(selectedAssets.size);
      clearSelection();
      // Clear the success message after 3 seconds
      setTimeout(() => setQueueAddedCount(null), 3000);
    } catch (error) {
      console.error('Failed to add to queue:', error);
    }
  };

  // Marketplace listing handlers
  const handleListAsset = (asset: GearAsset) => {
    setAssetToList(asset);
    setAssetsToList([]);
    setIsListingDialogOpen(true);
  };

  const handleBulkListAssets = () => {
    if (selectedAssets.size === 0) return;
    const selectedAssetsList = assets.filter(a => selectedAssets.has(a.id));
    setAssetToList(null);
    setAssetsToList(selectedAssetsList);
    setIsListingDialogOpen(true);
  };

  const handleListingDialogClose = () => {
    setIsListingDialogOpen(false);
    setAssetToList(null);
    setAssetsToList([]);
    clearSelection();
  };

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

      {/* Queue Added Success Message */}
      {queueAddedCount !== null && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-sm text-green-400">
            Added {queueAddedCount} asset{queueAddedCount !== 1 ? 's' : ''} to print queue
          </span>
        </div>
      )}

      {/* Selection Toolbar - shows when items selected */}
      {selectedAssets.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-accent-yellow/10 rounded-lg border border-accent-yellow/30">
          <span className="text-sm font-medium text-bone-white">
            {selectedAssets.size} asset{selectedAssets.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddToQueue}
            disabled={addToQueue.isPending}
          >
            {addToQueue.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ListPlus className="w-4 h-4 mr-2" />
            )}
            Add to Queue
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkListAssets}
            className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow/10"
          >
            <Store className="w-4 h-4 mr-2" />
            List for Rent
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsBatchPrintModalOpen(true)}>
            <Printer className="w-4 h-4 mr-2" />
            Print Labels
          </Button>
          <Button variant="ghost" size="sm" onClick={clearSelection}>
            <XCircle className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      )}

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
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedAssets.size === assets.length && assets.length > 0}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
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
                <React.Fragment key={asset.id}>
                  <AssetRow
                    asset={asset}
                    isSelected={selectedAssets.has(asset.id)}
                    onToggle={toggleAsset}
                    onView={() => setSelectedAssetId(asset.id)}
                    onListForRent={handleListAsset}
                    isExpanded={expandedAssets.has(asset.id)}
                    onToggleExpand={() => toggleExpanded(asset.id)}
                    onConvertToPackage={() => setConvertingAssetId(asset.id)}
                  />
                  {/* Render accessories when expanded */}
                  {asset.is_equipment_package && expandedAssets.has(asset.id) && (
                    <AccessoryRows
                      parentAssetId={asset.id}
                      orgId={orgId}
                      onView={(accessoryId) => setSelectedAssetId(accessoryId)}
                      onRefetch={refetchAssets}
                    />
                  )}
                </React.Fragment>
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

      {/* Batch Print Modal */}
      <BatchPrintModal
        isOpen={isBatchPrintModalOpen}
        onClose={() => {
          setIsBatchPrintModalOpen(false);
          clearSelection();
        }}
        orgId={orgId}
        selectedAssetIds={Array.from(selectedAssets)}
      />

      {/* Create Listing Dialog */}
      <CreateListingDialog
        isOpen={isListingDialogOpen}
        onClose={handleListingDialogClose}
        orgId={orgId}
        asset={assetToList}
        assets={assetsToList}
        onSuccess={() => {
          // Optionally refresh assets or show success toast
        }}
      />

      {/* Convert to Equipment Package Dialog */}
      <ConvertToEquipmentPackageDialog
        isOpen={!!convertingAssetId}
        onClose={() => setConvertingAssetId(null)}
        assetId={convertingAssetId}
        orgId={orgId}
        onSuccess={refetchAssets}
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
  isSelected: boolean;
  onToggle: (assetId: string) => void;
  onView: () => void;
  onListForRent: (asset: GearAsset) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onConvertToPackage?: () => void;
}

function AssetRow({ asset, isSelected, onToggle, onView, onListForRent, isExpanded, onToggleExpand, onConvertToPackage }: AssetRowProps) {
  const statusConfig = STATUS_CONFIG[asset.status] || STATUS_CONFIG.available;
  const conditionConfig = CONDITION_CONFIG[asset.current_condition as AssetCondition] || { label: 'Unknown', color: 'text-muted-gray' };
  const hasAccessories = asset.is_equipment_package && (asset.accessory_count ?? 0) > 0;

  return (
    <TableRow
      className={cn(
        "border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer",
        isSelected && "bg-accent-yellow/10"
      )}
      onClick={onView}
    >
      {/* Expand/Collapse Column */}
      <TableCell onClick={(e) => e.stopPropagation()} className="px-2">
        {hasAccessories ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-accent-yellow" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-gray" />
            )}
          </Button>
        ) : (
          <div className="w-6" />
        )}
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(asset.id)}
          aria-label={`Select ${asset.name}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted-gray/20 flex items-center justify-center">
            {hasAccessories ? (
              <Package className="w-5 h-5 text-accent-yellow" />
            ) : (
              <Box className="w-5 h-5 text-muted-gray" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-bone-white">{asset.name}</p>
              {hasAccessories && (
                <Badge variant="outline" className="text-xs border-accent-yellow/50 text-accent-yellow">
                  {asset.accessory_count} accessori{asset.accessory_count === 1 ? 'y' : 'es'}
                </Badge>
              )}
            </div>
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
            <DropdownMenuItem onClick={() => onListForRent(asset)}>
              <Store className="w-4 h-4 mr-2" /> List for Rent
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {!asset.is_equipment_package && !asset.parent_asset_id && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onConvertToPackage?.(); }}>
                <Package className="w-4 h-4 mr-2" /> Convert to Equipment Package
              </DropdownMenuItem>
            )}
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

  // Pricing fields
  const [purchasePrice, setPurchasePrice] = useState<string>('');
  const [replacementCost, setReplacementCost] = useState<string>('');
  const [dailyRate, setDailyRate] = useState<string>('');
  const [weeklyRate, setWeeklyRate] = useState<string>('');
  const [monthlyRate, setMonthlyRate] = useState<string>('');

  const { locations, createLocation } = useGearLocations(orgId);
  const [homeLocationId, setHomeLocationId] = useState<string>('');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationName, setNewLocationName] = useState('');

  // Handle quick add location
  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;
    try {
      const result = await createLocation.mutateAsync({
        name: newLocationName.trim(),
        location_type: 'warehouse',
      });
      setHomeLocationId(result.location.id);
      setShowAddLocation(false);
      setNewLocationName('');
    } catch (err) {
      console.error('Failed to create location:', err);
    }
  };

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
        // Pricing
        purchase_price: purchasePrice ? parseFloat(purchasePrice) : undefined,
        replacement_cost: replacementCost ? parseFloat(replacementCost) : undefined,
        daily_rate: dailyRate ? parseFloat(dailyRate) : undefined,
        weekly_rate: weeklyRate ? parseFloat(weeklyRate) : undefined,
        monthly_rate: monthlyRate ? parseFloat(monthlyRate) : undefined,
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
      setPurchasePrice('');
      setReplacementCost('');
      setDailyRate('');
      setWeeklyRate('');
      setMonthlyRate('');
      setShowAddLocation(false);
      setNewLocationName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create asset');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Add New Asset</DialogTitle>
          <DialogDescription>Add a new piece of equipment to your inventory</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-4 pb-4">
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
              <Label htmlFor="serial">Manufacturer Serial Number</Label>
              <Input
                id="serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="From equipment label"
                className="font-mono"
              />
              <p className="text-xs text-muted-gray mt-1">
                Internal ID will be auto-generated
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Home Location
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddLocation(!showAddLocation)}
                  className="text-accent-yellow hover:text-accent-yellow/80 h-6 px-2 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
              <Select value={homeLocationId} onValueChange={setHomeLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-gray text-center">
                      No locations yet
                    </div>
                  ) : (
                    locations.map((loc) => (
                      <SelectItem key={loc.id} value={loc.id}>
                        {loc.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {/* Quick Add Location Form */}
              {showAddLocation && (
                <div className="p-3 bg-charcoal-black/30 rounded-lg space-y-2">
                  <Input
                    placeholder="Location name"
                    value={newLocationName}
                    onChange={(e) => setNewLocationName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddLocation();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddLocation}
                      disabled={!newLocationName.trim() || createLocation.isPending}
                    >
                      {createLocation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-1" />
                      )}
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddLocation(false);
                        setNewLocationName('');
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pricing Section */}
          <div className="border-t border-muted-gray/30 pt-4 mt-4">
            <Label className="text-sm font-medium text-muted-gray mb-3 block">Pricing & Value</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="purchasePrice">Purchase Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="purchasePrice"
                    type="number"
                    min="0"
                    step="0.01"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="replacementCost">Replacement Cost</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="replacementCost"
                    type="number"
                    min="0"
                    step="0.01"
                    value={replacementCost}
                    onChange={(e) => setReplacementCost(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Rental Rates Section */}
          <div className="border-t border-muted-gray/30 pt-4">
            <Label className="text-sm font-medium text-muted-gray mb-3 block">Rental Rates</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="dailyRate">Daily Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="dailyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="weeklyRate">Weekly Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="weeklyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={weeklyRate}
                    onChange={(e) => setWeeklyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="monthlyRate">Monthly Rate</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                  <Input
                    id="monthlyRate"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyRate}
                    onChange={(e) => setMonthlyRate(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-muted-gray/30">
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
  const { session } = useAuth();
  const { asset, isLoading, updateAsset, refetch } = useGearAsset(assetId, { includeAccessories: true });
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<GearAsset>>({});
  const [editPhotos, setEditPhotos] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

  // Labels hook
  const { getAssetBarcode, getAssetQR, generateCodes } = useGearLabels(asset?.organization_id ?? null);

  // Initialize edit form when asset loads or edit mode is entered
  const startEditing = () => {
    if (asset) {
      setEditForm({
        name: asset.name,
        manufacturer: asset.manufacturer,
        model: asset.model,
        serial_number: asset.serial_number,
        description: asset.description,
        notes: asset.notes,
        // Pricing fields
        purchase_price: asset.purchase_price,
        replacement_cost: asset.replacement_cost,
        daily_rate: asset.daily_rate,
        weekly_rate: asset.weekly_rate,
        monthly_rate: asset.monthly_rate,
      });
      // Initialize photos from current asset
      setEditPhotos(asset.photos_current || []);
      setIsEditing(true);
    }
  };

  // Photo upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (editPhotos.length >= 6) {
        toast.error('Maximum 6 photos allowed');
        break;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setEditPhotos((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    setEditPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!asset) return;
    setIsSaving(true);
    try {
      // Include photos in the update
      await updateAsset.mutateAsync({ ...editForm, photos: editPhotos });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update asset:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm({});
  };

  const handleGenerateCodes = async () => {
    if (!asset) return;
    setIsGeneratingCodes(true);
    try {
      await generateCodes.mutateAsync([asset.id]);
      // Refetch asset to get updated barcode/qr_code values
      refetch();
    } catch (error) {
      console.error('Failed to generate codes:', error);
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handlePrintLabel = async (labelType: 'barcode' | 'qr' | 'both') => {
    if (!asset) return;

    // Fetch label HTML with auth headers
    const labelUrl = `/api/v1/gear/labels/asset/${asset.id}/label?label_type=${labelType}&include_name=true&include_category=true`;
    try {
      const response = await fetch(labelUrl, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch label');
      const html = await response.text();

      // Open new window and write HTML content
      const printWindow = window.open('', '_blank', 'width=400,height=400');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        // Auto-trigger print dialog
        printWindow.onload = () => printWindow.print();
      }
    } catch (error) {
      console.error('Failed to print label:', error);
    }
  };

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
                <Badge className={cn('border', (STATUS_CONFIG[asset.status] || STATUS_CONFIG.available).color)}>
                  {(STATUS_CONFIG[asset.status] || STATUS_CONFIG.available).icon}
                  <span className="ml-1">{(STATUS_CONFIG[asset.status] || STATUS_CONFIG.available).label}</span>
                </Badge>
                {asset.is_equipment_package && (
                  <Badge className="border bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                    <Link className="w-3 h-3 mr-1" />
                    Equipment Package
                  </Badge>
                )}
                <span className={cn('text-sm', (CONDITION_CONFIG[asset.current_condition as AssetCondition] || { color: 'text-muted-gray' }).color)}>
                  {(CONDITION_CONFIG[asset.current_condition as AssetCondition] || { label: 'Unknown' }).label} condition
                </span>
              </div>

              {/* Equipment Package Contents */}
              {asset.is_equipment_package && (asset as any).accessories && (asset as any).accessories.length > 0 && !isEditing && (
                <div className="border border-accent-yellow/30 rounded-lg bg-accent-yellow/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Link className="w-4 h-4 text-accent-yellow" />
                    <Label className="text-sm font-medium text-accent-yellow">
                      Package Contents ({(asset as any).accessories.length} accessories)
                    </Label>
                  </div>
                  <div className="space-y-2">
                    {(asset as any).accessories.map((acc: any) => (
                      <div
                        key={acc.id}
                        className="flex items-center gap-3 p-2 bg-charcoal-black/30 rounded-lg"
                      >
                        <div className="w-8 h-8 rounded bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
                          <Package className="w-4 h-4 text-muted-gray" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-bone-white truncate">{acc.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-gray">
                            <code>{acc.internal_id}</code>
                            {acc.category_name && (
                              <>
                                <span>•</span>
                                <span>{acc.category_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Badge className={cn('border text-xs', (STATUS_CONFIG[acc.status as AssetStatus] || STATUS_CONFIG.available).color)}>
                          {(STATUS_CONFIG[acc.status as AssetStatus] || STATUS_CONFIG.available).label}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Details Grid */}
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="edit-name">Name</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit-manufacturer">Manufacturer</Label>
                      <Input
                        id="edit-manufacturer"
                        value={editForm.manufacturer || ''}
                        onChange={(e) => setEditForm({ ...editForm, manufacturer: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-model">Model</Label>
                      <Input
                        id="edit-model"
                        value={editForm.model || ''}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="edit-serial">Manufacturer Serial Number</Label>
                    <Input
                      id="edit-serial"
                      value={editForm.serial_number || ''}
                      onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
                      placeholder="From equipment label"
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea
                      id="edit-notes"
                      value={editForm.notes || ''}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={2}
                    />
                  </div>

                  {/* Pricing & Value Section */}
                  <div className="border-t border-muted-gray/30 pt-4 mt-4">
                    <Label className="text-sm font-medium text-muted-gray mb-3 block">Pricing & Value</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="edit-purchase-price">Purchase Price</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-purchase-price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.purchase_price ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, purchase_price: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-replacement-cost">Replacement Cost</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-replacement-cost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.replacement_cost ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, replacement_cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rental Rates Section */}
                  <div className="border-t border-muted-gray/30 pt-4 mt-4">
                    <Label className="text-sm font-medium text-muted-gray mb-3 block">Rental Rates</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="edit-daily-rate">Daily Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-daily-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.daily_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, daily_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-weekly-rate">Weekly Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-weekly-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.weekly_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, weekly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="edit-monthly-rate">Monthly Rate</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-gray">$</span>
                          <Input
                            id="edit-monthly-rate"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editForm.monthly_rate ?? ''}
                            onChange={(e) => setEditForm({ ...editForm, monthly_rate: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="pl-7"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Photos Section */}
                  <div className="border-t border-muted-gray/30 pt-4 mt-4">
                    <Label className="text-sm font-medium text-muted-gray mb-3 block flex items-center gap-2">
                      <ImagePlus className="h-4 w-4" />
                      Photos
                      <span className="text-xs font-normal">(Required for marketplace listings)</span>
                    </Label>

                    {/* Photo Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {editPhotos.map((photo, index) => (
                        <div
                          key={index}
                          className="relative aspect-square rounded-lg overflow-hidden bg-white/10"
                        >
                          <img
                            src={photo}
                            alt={`Photo ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {index === 0 && (
                            <span className="absolute bottom-1 left-1 text-xs bg-accent-yellow text-black px-1 rounded">
                              Main
                            </span>
                          )}
                        </div>
                      ))}

                      {/* Upload Button */}
                      {editPhotos.length < 6 && (
                        <label className="aspect-square rounded-lg border-2 border-dashed border-white/20 hover:border-accent-yellow/50 flex flex-col items-center justify-center cursor-pointer transition-colors">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          <Camera className="h-6 w-6 text-muted-gray mb-1" />
                          <span className="text-xs text-muted-gray">Add Photo</span>
                        </label>
                      )}
                    </div>

                    {editPhotos.length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed border-white/20 rounded-lg mt-3">
                        <Upload className="h-8 w-8 mx-auto text-muted-gray mb-2" />
                        <p className="text-sm text-muted-gray">
                          Drag photos here or click to upload
                        </p>
                        <label className="mt-2 inline-block">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handlePhotoUpload}
                            className="hidden"
                          />
                          <Button type="button" variant="outline" size="sm" asChild>
                            <span>Choose Files</span>
                          </Button>
                        </label>
                      </div>
                    )}

                    <p className="text-xs text-muted-gray mt-2">
                      Up to 6 photos. First photo will be the main image.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Internal ID" value={asset.internal_id} mono />
                    <DetailItem label="Category" value={asset.category_name} />
                    <DetailItem label="Manufacturer" value={asset.manufacturer} />
                    <DetailItem label="Model" value={asset.model} />
                    <DetailItem label="Serial Number" value={asset.serial_number} mono />
                    <DetailItem label="Asset Type" value={ASSET_TYPE_LABELS[asset.asset_type]} />
                    <DetailItem label="Current Location" value={asset.current_location_name} />
                    <DetailItem label="Current Custodian" value={asset.current_custodian_name} />
                  </div>

                  {/* Pricing & Value Section */}
                  {(asset.purchase_price || asset.replacement_cost || asset.daily_rate || asset.weekly_rate || asset.monthly_rate) && (
                    <div className="border-t border-muted-gray/30 pt-4">
                      <Label className="text-sm font-medium text-muted-gray mb-3 block">Pricing & Value</Label>
                      <div className="grid grid-cols-2 gap-4">
                        {asset.purchase_price && (
                          <DetailItem
                            label="Purchase Price"
                            value={`$${asset.purchase_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          />
                        )}
                        {asset.replacement_cost && (
                          <DetailItem
                            label="Replacement Cost"
                            value={`$${asset.replacement_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                          />
                        )}
                      </div>
                      {(asset.daily_rate || asset.weekly_rate || asset.monthly_rate) && (
                        <div className="grid grid-cols-3 gap-4 mt-3">
                          {asset.daily_rate && (
                            <DetailItem
                              label="Daily Rate"
                              value={`$${asset.daily_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            />
                          )}
                          {asset.weekly_rate && (
                            <DetailItem
                              label="Weekly Rate"
                              value={`$${asset.weekly_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            />
                          )}
                          {asset.monthly_rate && (
                            <DetailItem
                              label="Monthly Rate"
                              value={`$${asset.monthly_rate.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

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

                  {/* Photos Section (View Mode) */}
                  {asset.photos_current && asset.photos_current.length > 0 && (
                    <div className="border-t border-muted-gray/30 pt-4">
                      <Label className="text-sm font-medium text-muted-gray mb-3 block flex items-center gap-2">
                        <ImagePlus className="h-4 w-4" />
                        Photos ({asset.photos_current.length})
                      </Label>
                      <div className="grid grid-cols-3 gap-3">
                        {asset.photos_current.map((photo, index) => (
                          <div
                            key={index}
                            className="relative aspect-square rounded-lg overflow-hidden bg-white/10"
                          >
                            <img
                              src={photo}
                              alt={`Photo ${index + 1}`}
                              className="h-full w-full object-cover"
                            />
                            {index === 0 && (
                              <span className="absolute bottom-1 left-1 text-xs bg-accent-yellow text-black px-1 rounded">
                                Main
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Labels & Scanning Section */}
                  <div className="border-t border-muted-gray/30 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium text-muted-gray flex items-center gap-2">
                        <Barcode className="w-4 h-4" />
                        Labels & Scanning
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerateCodes}
                          disabled={isGeneratingCodes}
                        >
                          {isGeneratingCodes ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-1" />
                          )}
                          {asset.barcode ? 'Regenerate' : 'Generate'}
                        </Button>
                        {asset.barcode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Printer className="w-4 h-4 mr-1" />
                                Print
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handlePrintLabel('barcode')}>
                                <Barcode className="w-4 h-4 mr-2" />
                                Barcode Only
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handlePrintLabel('qr')}>
                                <QrCode className="w-4 h-4 mr-2" />
                                QR Code Only
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handlePrintLabel('both')}>
                                <Package className="w-4 h-4 mr-2" />
                                Both (Full Label)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>

                    {asset.barcode ? (
                      <div className="space-y-4">
                        {/* Barcode Display */}
                        <div className="bg-white rounded-lg p-4 flex flex-col items-center">
                          <AuthenticatedImage
                            src={getAssetBarcode(asset.id)}
                            alt={`Barcode: ${asset.barcode}`}
                            className="max-w-full h-16 object-contain"
                          />
                          <code className="text-xs text-gray-600 mt-2">{asset.barcode}</code>
                        </div>

                        {/* QR Code Display */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white rounded-lg p-3 flex flex-col items-center">
                            <AuthenticatedImage
                              src={getAssetQR(asset.id)}
                              alt={`QR Code: ${asset.qr_code}`}
                              className="w-24 h-24 object-contain"
                            />
                            <code className="text-xs text-gray-600 mt-1 truncate max-w-full">{asset.qr_code}</code>
                          </div>
                          <div className="flex flex-col justify-center text-sm text-muted-gray space-y-2">
                            <p><strong>Scan this asset</strong> to:</p>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              <li>Add to checkout list</li>
                              <li>Add to kit contents</li>
                              <li>View asset details</li>
                              <li>Record condition check</li>
                            </ul>
                          </div>
                        </div>

                        {/* Toggle preview */}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-muted-gray"
                          onClick={() => setShowLabelPreview(!showLabelPreview)}
                        >
                          <ExternalLink className="w-4 h-4 mr-1" />
                          {showLabelPreview ? 'Hide' : 'Show'} Printable Label Preview
                        </Button>

                        {showLabelPreview && (
                          <div className="bg-white rounded-lg p-4 border-2 border-dashed border-gray-300">
                            <div className="flex justify-between items-start gap-4">
                              <div className="flex-1">
                                <AuthenticatedImage
                                  src={getAssetBarcode(asset.id)}
                                  alt="Barcode"
                                  className="max-w-full h-12 object-contain"
                                />
                              </div>
                              <AuthenticatedImage
                                src={getAssetQR(asset.id)}
                                alt="QR Code"
                                className="w-16 h-16 object-contain"
                              />
                            </div>
                            <div className="mt-2">
                              <p className="font-bold text-sm text-black truncate">{asset.name}</p>
                              <p className="font-mono text-xs text-gray-600">{asset.internal_id}</p>
                              {asset.category_name && (
                                <p className="text-xs text-gray-500">{asset.category_name}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-charcoal-black/30 rounded-lg">
                        <QrCode className="w-8 h-8 mx-auto mb-2 text-muted-gray" />
                        <p className="text-sm text-muted-gray mb-3">
                          No barcode or QR code generated yet
                        </p>
                        <Button
                          size="sm"
                          onClick={handleGenerateCodes}
                          disabled={isGeneratingCodes}
                        >
                          {isGeneratingCodes ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Barcode className="w-4 h-4 mr-1" />
                          )}
                          Generate Barcode & QR Code
                        </Button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-muted-gray">Asset not found</p>
          )}
        </ScrollArea>

        <DialogFooter>
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={startEditing}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Asset
              </Button>
            </>
          )}
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

// ============================================================================
// ACCESSORY ROWS (for expanded equipment packages)
// ============================================================================

interface AccessoryRowsProps {
  parentAssetId: string;
  orgId: string;
  onView: (assetId: string) => void;
  onRefetch: () => void;
}

function AccessoryRows({ parentAssetId, orgId, onView, onRefetch }: AccessoryRowsProps) {
  const { assets: accessories, isLoading } = useGearAssets({
    orgId,
    parentAssetId,
    limit: 100,
  });

  const { removeAccessory } = useGearAsset(parentAssetId);

  const handleRemoveAccessory = async (accessoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeAccessory.mutateAsync(accessoryId);
      onRefetch();
      toast.success('Accessory removed from equipment package');
    } catch (error) {
      toast.error('Failed to remove accessory');
    }
  };

  if (isLoading) {
    return (
      <TableRow className="bg-charcoal-black/20 border-muted-gray/20">
        <TableCell colSpan={9} className="py-2">
          <div className="flex items-center gap-2 pl-12">
            <Loader2 className="w-4 h-4 animate-spin text-muted-gray" />
            <span className="text-sm text-muted-gray">Loading accessories...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {accessories.map((accessory, index) => {
        const statusConfig = STATUS_CONFIG[accessory.status] || STATUS_CONFIG.available;
        const isLast = index === accessories.length - 1;

        return (
          <TableRow
            key={accessory.id}
            className="bg-charcoal-black/20 border-muted-gray/20 hover:bg-charcoal-black/30 cursor-pointer"
            onClick={() => onView(accessory.id)}
          >
            {/* Tree line indicator */}
            <TableCell className="px-2 relative">
              <div className="absolute left-4 -top-[1px] w-0.5 h-full bg-accent-yellow/30" />
              <div className={cn(
                "absolute left-4 top-1/2 w-4 h-0.5 bg-accent-yellow/30",
                isLast && "rounded-bl"
              )} />
              {isLast && <div className="absolute left-4 top-1/2 bottom-0 w-0.5 bg-transparent" />}
            </TableCell>
            <TableCell>
              {/* Empty - no checkbox for accessories */}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3 pl-4">
                <div className="w-8 h-8 rounded-lg bg-accent-yellow/10 flex items-center justify-center">
                  <Link className="w-4 h-4 text-accent-yellow/70" />
                </div>
                <div>
                  <p className="font-medium text-bone-white/80">{accessory.name}</p>
                  {accessory.manufacturer && (
                    <p className="text-sm text-muted-gray">
                      {accessory.manufacturer} {accessory.model && `• ${accessory.model}`}
                    </p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <code className="text-sm bg-muted-gray/20 px-2 py-1 rounded text-muted-gray">{accessory.internal_id}</code>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-gray">{accessory.category_name || '—'}</span>
            </TableCell>
            <TableCell>
              <Badge className={cn('border', statusConfig.color)}>
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-gray">
                {(CONDITION_CONFIG[accessory.current_condition as AssetCondition] || { label: 'Unknown' }).label}
              </span>
            </TableCell>
            <TableCell>
              <span className="text-sm text-muted-gray">
                {accessory.current_custodian_name || accessory.current_location_name || '—'}
              </span>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => handleRemoveAccessory(accessory.id, e)}
                disabled={removeAccessory.isPending}
                className="text-muted-gray hover:text-red-400"
              >
                <Unlink className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

// ============================================================================
// CONVERT TO EQUIPMENT PACKAGE DIALOG
// ============================================================================

interface ConvertToEquipmentPackageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assetId: string | null;
  orgId: string;
  onSuccess: () => void;
}

function ConvertToEquipmentPackageDialog({
  isOpen,
  onClose,
  assetId,
  orgId,
  onSuccess,
}: ConvertToEquipmentPackageDialogProps) {
  // Tab state
  const [dialogTab, setDialogTab] = useState<'existing' | 'create'>('existing');

  // Select existing state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAccessories, setSelectedAccessories] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Quick-add state
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddCategory, setQuickAddCategory] = useState('');
  const [quickAddManufacturer, setQuickAddManufacturer] = useState('');
  const [quickAddModel, setQuickAddModel] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const { categories } = useGearCategories(orgId);
  const { convertToPackage, asset: parentAsset } = useGearAsset(assetId, { includeAccessories: true });
  const { assets: availableAssets, isLoading, createAsset, refetch: refetchAssets } = useGearAssets({
    orgId,
    parentAssetId: 'none', // Only root assets
    search: searchTerm || undefined,
    categoryId: categoryFilter === 'all' ? undefined : categoryFilter,
    limit: 100,
    enabled: isOpen,
  });

  // Filter out the parent asset and already-packaged assets
  const filteredAssets = availableAssets.filter(
    (a) => a.id !== assetId && !a.is_equipment_package && !a.parent_asset_id
  );

  // Count of already-attached accessories
  const existingAccessoryCount = parentAsset?.accessory_count ?? 0;

  const toggleAccessory = (accessoryId: string) => {
    const newSelected = new Set(selectedAccessories);
    if (newSelected.has(accessoryId)) {
      newSelected.delete(accessoryId);
    } else {
      newSelected.add(accessoryId);
    }
    setSelectedAccessories(newSelected);
  };

  const handleConvert = async () => {
    if (selectedAccessories.size === 0) {
      toast.error('Please select at least one accessory');
      return;
    }

    try {
      await convertToPackage.mutateAsync(Array.from(selectedAccessories));
      toast.success(`Converted to equipment package with ${selectedAccessories.size} accessori${selectedAccessories.size === 1 ? 'y' : 'es'}`);
      setSelectedAccessories(new Set());
      setSearchTerm('');
      setCategoryFilter('all');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to convert to equipment package');
    }
  };

  const handleQuickAdd = async () => {
    if (!quickAddName.trim()) {
      toast.error('Accessory name is required');
      return;
    }

    setIsQuickAdding(true);
    try {
      await createAsset.mutateAsync({
        name: quickAddName.trim(),
        category_id: quickAddCategory || undefined,
        manufacturer: quickAddManufacturer || undefined,
        model: quickAddModel || undefined,
        parent_asset_id: assetId!,
      } as any);

      toast.success(`Added "${quickAddName}" to package`);

      // Reset form
      setQuickAddName('');
      setQuickAddCategory('');
      setQuickAddManufacturer('');
      setQuickAddModel('');

      // Refresh data
      refetchAssets();
      onSuccess();
    } catch (error) {
      toast.error('Failed to create accessory');
    } finally {
      setIsQuickAdding(false);
    }
  };

  const handleClose = () => {
    setSelectedAccessories(new Set());
    setSearchTerm('');
    setCategoryFilter('all');
    setDialogTab('existing');
    setQuickAddName('');
    setQuickAddCategory('');
    setQuickAddManufacturer('');
    setQuickAddModel('');
    onClose();
  };

  if (!assetId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {parentAsset?.is_equipment_package ? 'Add Accessories' : 'Convert to Equipment Package'}
          </DialogTitle>
          <DialogDescription>
            {parentAsset && (
              <span>
                {parentAsset.is_equipment_package
                  ? `Add accessories to ${parentAsset.name} (${existingAccessoryCount} current)`
                  : `Select accessories to group with ${parentAsset.name}`
                }
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={dialogTab} onValueChange={(v) => setDialogTab(v as 'existing' | 'create')} className="flex-1 min-h-0 flex flex-col">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
            <TabsTrigger value="existing">Select Existing</TabsTrigger>
            <TabsTrigger value="create">Quick Add</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="flex-1 min-h-0 flex flex-col gap-4 mt-4">
            {/* Search and Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
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
            </div>

            {/* Selected count */}
            {selectedAccessories.size > 0 && (
              <div className="flex items-center gap-2 p-2 bg-accent-yellow/10 rounded-lg border border-accent-yellow/30">
                <Package className="w-4 h-4 text-accent-yellow" />
                <span className="text-sm text-accent-yellow">
                  {selectedAccessories.size} accessori{selectedAccessories.size === 1 ? 'y' : 'es'} selected
                </span>
              </div>
            )}

            {/* Assets List */}
            <ScrollArea className="flex-1 min-h-[250px] border border-muted-gray/30 rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Box className="w-8 h-8 text-muted-gray mb-2" />
                  <p className="text-muted-gray">No available assets found</p>
                  <p className="text-sm text-muted-gray/70">Try the Quick Add tab to create new accessories</p>
                </div>
              ) : (
                <div className="divide-y divide-muted-gray/20">
                  {filteredAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className={cn(
                        "flex items-center gap-3 p-3 cursor-pointer transition-colors",
                        selectedAccessories.has(asset.id)
                          ? "bg-accent-yellow/10"
                          : "hover:bg-charcoal-black/30"
                      )}
                      onClick={() => toggleAccessory(asset.id)}
                    >
                      <Checkbox
                        checked={selectedAccessories.has(asset.id)}
                        onCheckedChange={() => toggleAccessory(asset.id)}
                      />
                      <div className="w-8 h-8 rounded-lg bg-muted-gray/20 flex items-center justify-center">
                        <Box className="w-4 h-4 text-muted-gray" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-bone-white truncate">{asset.name}</p>
                        <p className="text-sm text-muted-gray truncate">
                          {asset.category_name || 'Uncategorized'}
                          {asset.manufacturer && ` • ${asset.manufacturer}`}
                        </p>
                      </div>
                      <code className="text-xs bg-muted-gray/20 px-2 py-1 rounded text-muted-gray">
                        {asset.internal_id}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="create" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="quickAddName">Accessory Name *</Label>
              <Input
                id="quickAddName"
                value={quickAddName}
                onChange={(e) => setQuickAddName(e.target.value)}
                placeholder="e.g., XLR Cable 25ft"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quickAddCategory">Category</Label>
                <Select value={quickAddCategory} onValueChange={setQuickAddCategory}>
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
                <Label htmlFor="quickAddManufacturer">Manufacturer</Label>
                <Input
                  id="quickAddManufacturer"
                  value={quickAddManufacturer}
                  onChange={(e) => setQuickAddManufacturer(e.target.value)}
                  placeholder="e.g., Mogami"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="quickAddModel">Model</Label>
              <Input
                id="quickAddModel"
                value={quickAddModel}
                onChange={(e) => setQuickAddModel(e.target.value)}
                placeholder="e.g., Gold Studio"
              />
            </div>

            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddName.trim() || isQuickAdding}
              className="w-full"
            >
              {isQuickAdding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Plus className="w-4 h-4 mr-2" />
              Add to Package
            </Button>

            <p className="text-xs text-muted-gray text-center">
              The accessory will be created and immediately added to this equipment package
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {dialogTab === 'create' ? 'Done' : 'Cancel'}
          </Button>
          {dialogTab === 'existing' && (
            <Button
              onClick={handleConvert}
              disabled={selectedAccessories.size === 0 || convertToPackage.isPending}
            >
              {convertToPackage.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Package className="w-4 h-4 mr-2" />
              Add to Package ({selectedAccessories.size})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
