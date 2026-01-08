/**
 * Items Section
 * Barcode scanner + browse functionality for checkout
 * Supports both USB barcode scanner and camera-based scanning
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Barcode,
  Package,
  Layers,
  Search,
  X,
  Loader2,
  AlertCircle,
  Check,
  Link,
  Camera,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { useGearAssets, useGearKitInstances, useGearKitInstance, useGearScanLookup } from '@/hooks/gear';
import { useAuth } from '@/context/AuthContext';
import { CameraScannerModal } from '@/components/gear/scanner';
import type { ScanResult } from '@/types/scanner';
import type { GearAsset, GearKitInstance } from '@/types/gear';
import type { SelectedItem } from './CheckoutDialog';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Component to browse and select a kit - fetches full data on click
function KitBrowseCard({
  kit,
  onSelect,
  orgId,
}: {
  kit: GearKitInstance;
  onSelect: (kit: GearKitInstance) => void;
  orgId: string;
}) {
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const { kit: fullKit, isLoading } = useGearKitInstance(selectedKitId);

  // When full kit loads, call onSelect
  useEffect(() => {
    if (fullKit && selectedKitId) {
      onSelect(fullKit);
      setSelectedKitId(null);
    }
  }, [fullKit, selectedKitId, onSelect]);

  const handleClick = () => {
    setSelectedKitId(kit.id);
  };

  // Use asset_count from list response, fallback to contents length
  const itemCount = (kit as any).asset_count ?? kit.contents?.length ?? 0;

  return (
    <Card
      className={cn(
        'bg-charcoal-black/30 border-muted-gray/30 transition-colors',
        isLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:border-accent-yellow/50'
      )}
      onClick={isLoading ? undefined : handleClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {isLoading ? (
            <Loader2 className="w-5 h-5 text-purple-400 flex-shrink-0 animate-spin" />
          ) : (
            <Layers className="w-5 h-5 text-purple-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{kit.name}</p>
            <p className="text-xs text-muted-gray">
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            Add All
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

interface ItemsSectionProps {
  orgId: string;
  selectedItems: SelectedItem[];
  onAddItem: (item: SelectedItem) => void;
  onRemoveItem: (id: string) => void;
  scannerRef: React.RefObject<HTMLInputElement>;
}

export function ItemsSection({
  orgId,
  selectedItems,
  onAddItem,
  onRemoveItem,
  scannerRef,
}: ItemsSectionProps) {
  const { session } = useAuth();
  const token = session?.access_token;

  // Scanner state
  const [scanInput, setScanInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Browse state
  const [showBrowse, setShowBrowse] = useState(false);
  const [browseMode, setBrowseMode] = useState<'assets' | 'kits'>('assets');
  const [searchQuery, setSearchQuery] = useState('');

  // Hooks
  const { lookupAsset } = useGearScanLookup(orgId);

  // Helper to fetch asset with accessories
  const fetchAssetWithAccessories = async (assetId: string): Promise<GearAsset & { accessories?: GearAsset[] }> => {
    const response = await fetch(
      `${API_BASE}/api/v1/gear/assets/item/${assetId}?include_accessories=true`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await response.json();
    return data.asset;
  };

  // Add equipment package accessories
  const addPackageAccessories = async (asset: GearAsset) => {
    if (!asset.is_equipment_package) return;

    setIsAddingPackage(true);
    try {
      const fullAsset = await fetchAssetWithAccessories(asset.id);
      fullAsset.accessories?.forEach((acc) => {
        if (!selectedItems.some((item) => item.id === acc.id)) {
          onAddItem({
            id: acc.id,
            type: 'asset',
            name: acc.name,
            internalId: acc.internal_id,
            status: acc.status,
            dailyRate: acc.daily_rate,
            weeklyRate: acc.weekly_rate,
            monthlyRate: acc.monthly_rate,
            fromPackageId: asset.id,
            fromPackageName: asset.name,
          });
        }
      });
    } catch (err) {
      console.error('Failed to fetch package accessories:', err);
    } finally {
      setIsAddingPackage(false);
    }
  };
  const { assets, isLoading: assetsLoading } = useGearAssets({
    orgId,
    search: searchQuery || undefined,
    status: 'available',
    limit: 50,
    enabled: showBrowse && browseMode === 'assets',
  });
  const { instances: kits, isLoading: kitsLoading } = useGearKitInstances(
    showBrowse && browseMode === 'kits' ? orgId : null,
    { status: 'available' }
  );

  // Handle barcode scan
  const handleScanSubmit = useCallback(async () => {
    if (!scanInput.trim()) return;
    setScanError(null);

    try {
      const result = await lookupAsset.mutateAsync(scanInput.trim());
      const asset = result.asset as GearAsset;

      if (!asset) {
        setScanError(`No asset found: ${scanInput}`);
        setTimeout(() => setScanError(null), 3000);
        return;
      }

      if (asset.status !== 'available') {
        setScanError(`"${asset.name}" is ${asset.status}`);
        setTimeout(() => setScanError(null), 3000);
        return;
      }

      if (selectedItems.some((item) => item.id === asset.id)) {
        setScanError(`"${asset.name}" already selected`);
        setTimeout(() => setScanError(null), 3000);
        return;
      }

      onAddItem({
        id: asset.id,
        type: 'asset',
        name: asset.name,
        internalId: asset.internal_id,
        status: asset.status,
        dailyRate: asset.daily_rate,
        weeklyRate: asset.weekly_rate,
        monthlyRate: asset.monthly_rate,
        isPackageParent: asset.is_equipment_package,
      });

      // If it's an equipment package, also add all accessories
      if (asset.is_equipment_package) {
        addPackageAccessories(asset);
      }

      setScanInput('');
    } catch {
      setScanError(`Scan failed: ${scanInput}`);
      setTimeout(() => setScanError(null), 3000);
    }
  }, [scanInput, lookupAsset, selectedItems, onAddItem, addPackageAccessories]);

  // Handle scan input keypress
  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanSubmit();
    }
  };

  // Handle camera scan result
  const handleCameraScan = useCallback(
    (result: ScanResult) => {
      // Use the scanned code to do a lookup
      setScanInput(result.code);
      setShowCameraScanner(false);
      // Trigger the lookup
      setTimeout(() => {
        lookupAsset.mutateAsync(result.code).then((res) => {
          const asset = res.asset as GearAsset;
          if (!asset) {
            setScanError(`No asset found: ${result.code}`);
            setTimeout(() => setScanError(null), 3000);
            return;
          }
          if (asset.status !== 'available') {
            setScanError(`"${asset.name}" is ${asset.status}`);
            setTimeout(() => setScanError(null), 3000);
            return;
          }
          if (selectedItems.some((item) => item.id === asset.id)) {
            setScanError(`"${asset.name}" already selected`);
            setTimeout(() => setScanError(null), 3000);
            return;
          }
          onAddItem({
            id: asset.id,
            type: 'asset',
            name: asset.name,
            internalId: asset.internal_id,
            status: asset.status,
            dailyRate: asset.daily_rate,
            weeklyRate: asset.weekly_rate,
            monthlyRate: asset.monthly_rate,
            isPackageParent: asset.is_equipment_package,
          });
          if (asset.is_equipment_package) {
            addPackageAccessories(asset);
          }
          setScanInput('');
        }).catch(() => {
          setScanError(`Scan failed: ${result.code}`);
          setTimeout(() => setScanError(null), 3000);
        });
      }, 100);
    },
    [lookupAsset, selectedItems, onAddItem, addPackageAccessories]
  );

  // Add asset from browse
  const handleAddAsset = (asset: GearAsset) => {
    if (selectedItems.some((item) => item.id === asset.id)) return;
    onAddItem({
      id: asset.id,
      type: 'asset',
      name: asset.name,
      internalId: asset.internal_id,
      status: asset.status,
      dailyRate: asset.daily_rate,
      weeklyRate: asset.weekly_rate,
      monthlyRate: asset.monthly_rate,
      isPackageParent: asset.is_equipment_package,
    });

    // If it's an equipment package, also add all accessories
    if (asset.is_equipment_package) {
      addPackageAccessories(asset);
    }
  };

  // Add kit (adds all kit contents with kit tracking)
  const handleAddKit = (kit: GearKitInstance) => {
    const kitContents = kit.contents || [];
    kitContents.forEach((content) => {
      if (!selectedItems.some((item) => item.id === content.asset_id)) {
        onAddItem({
          id: content.asset_id,
          type: 'asset',
          name: content.asset_name || 'Unknown',
          internalId: content.asset_internal_id || '',
          status: 'available',
          fromKitId: kit.id,
          fromKitName: kit.name,
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Scanner Input - Always Visible */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2 text-sm">
          <Barcode className="w-4 h-4" />
          Scan Barcode / QR Code
        </Label>
        <div className="flex gap-2">
          <Input
            ref={scannerRef}
            value={scanInput}
            onChange={(e) => {
              setScanInput(e.target.value);
              setScanError(null);
            }}
            onKeyDown={handleScanKeyDown}
            placeholder="Scan or type asset code..."
            className={cn(
              'flex-1',
              scanError && 'border-red-500 focus-visible:ring-red-500'
            )}
            autoComplete="off"
          />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCameraScanner(true)}
                  className="flex-shrink-0"
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Scan with camera</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            type="button"
            variant="secondary"
            onClick={handleScanSubmit}
            disabled={!scanInput.trim() || lookupAsset.isPending}
          >
            {lookupAsset.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
        </div>
        {scanError && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {scanError}
          </p>
        )}
      </div>

      {/* Browse Toggle */}
      <div className="flex items-center gap-4 pt-2 border-t border-muted-gray/20">
        <Button
          type="button"
          variant={showBrowse && browseMode === 'assets' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setShowBrowse(true);
            setBrowseMode('assets');
          }}
        >
          <Package className="w-4 h-4 mr-2" />
          Browse Assets
        </Button>
        <Button
          type="button"
          variant={showBrowse && browseMode === 'kits' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setShowBrowse(true);
            setBrowseMode('kits');
          }}
        >
          <Layers className="w-4 h-4 mr-2" />
          Browse Kits
        </Button>
        {showBrowse && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowBrowse(false)}
            className="ml-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Browse Panel */}
      {showBrowse && (
        <div className="border border-muted-gray/30 rounded-lg overflow-hidden">
          {/* Search */}
          {browseMode === 'assets' && (
            <div className="p-3 border-b border-muted-gray/20">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter assets..."
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {/* Results */}
          <ScrollArea className="h-48">
            {browseMode === 'assets' ? (
              assetsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                </div>
              ) : assets.length === 0 ? (
                <p className="text-center text-muted-gray py-8">No available assets</p>
              ) : (
                <div className="p-2 space-y-1">
                  {assets.map((asset) => {
                    const isSelected = selectedItems.some((i) => i.id === asset.id);
                    return (
                      <button
                        key={asset.id}
                        onClick={() => !isSelected && handleAddAsset(asset)}
                        disabled={isSelected}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                          isSelected
                            ? 'bg-green-500/10 text-green-400 cursor-default'
                            : 'hover:bg-charcoal-black/50'
                        )}
                      >
                        <Package className="w-4 h-4 text-muted-gray flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{asset.name}</p>
                          <code className="text-xs text-muted-gray">{asset.internal_id}</code>
                        </div>
                        {asset.daily_rate && (
                          <span className="text-xs text-muted-gray">${asset.daily_rate}/day</span>
                        )}
                        {isSelected && <Check className="w-4 h-4 flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )
            ) : kitsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
              </div>
            ) : kits.length === 0 ? (
              <p className="text-center text-muted-gray py-8">No available kits</p>
            ) : (
              <div className="p-2 space-y-2">
                {kits.map((kit) => (
                  <KitBrowseCard
                    key={kit.id}
                    kit={kit}
                    onSelect={handleAddKit}
                    orgId={orgId}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      )}

      {/* Selected Items */}
      {selectedItems.length > 0 && (
        <div className="pt-3 border-t border-muted-gray/20">
          <Label className="text-sm text-muted-gray mb-2 block">
            Selected ({selectedItems.length})
          </Label>
          <div className="flex flex-wrap gap-2">
            {selectedItems.map((item) => (
              <Badge
                key={item.id}
                variant="secondary"
                className="flex items-center gap-1 pr-1 py-1"
              >
                {item.isPackageParent ? (
                  <Link className="w-3 h-3 mr-1 text-accent-yellow" />
                ) : (
                  <Package className="w-3 h-3 mr-1" />
                )}
                <span className="truncate max-w-[150px]">{item.name}</span>
                {item.fromKitName && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-400 rounded">
                    {item.fromKitName}
                  </span>
                )}
                {item.fromPackageName && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-accent-yellow/20 text-accent-yellow rounded">
                    {item.fromPackageName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="ml-1 p-0.5 hover:text-red-400 transition-colors rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
        title="Scan Asset Barcode"
        scanMode="continuous"
        audioFeedback
        hapticFeedback
      />
    </div>
  );
}
