/**
 * Checkout Modal
 * Full-featured checkout flow with scanner, search, kit selection, and options
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  Barcode,
  Package,
  PackageOpen,
  User,
  UserPlus,
  Calendar,
  MapPin,
  Plus,
  FileText,
  FolderOpen,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Trash2,
  Building2,
  DollarSign,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import {
  useGearAssets,
  useGearKitInstances,
  useGearOrgMembers,
  useGearLocations,
  useGearScanLookup,
  useGearContacts,
  useGearRentals,
  type GearContact,
  type CreateContactInput,
} from '@/hooks/gear';
import { useProjects } from '@/hooks/backlot/useProjects';
import type { GearAsset, GearKitInstance, GearOrganizationMember, GearLocation, OrganizationType } from '@/types/gear';

interface SelectedItem {
  id: string;
  type: 'asset' | 'kit';
  name: string;
  internalId: string;
  status: string;
  // Pricing (populated from asset data)
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
}

interface ItemPricing {
  assetId: string;
  rateType: 'daily' | 'weekly' | 'flat';
  rate: number;
  quantity: number;
  lineTotal: number;
}

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    asset_ids: string[];
    custodian_user_id?: string;
    custodian_contact_id?: string;
    project_id?: string;
    checkout_at?: string;
    expected_return_at?: string;
    destination_location_id?: string;
    notes?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  orgId: string;
  orgType?: OrganizationType;
}

// Helper to determine default custodian type based on org type
function getDefaultCustodianType(orgType?: OrganizationType): 'member' | 'contact' {
  if (orgType === 'rental_house') return 'contact';
  return 'member'; // production_company, hybrid, and others default to member
}

export function CheckoutModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  orgId,
  orgType,
}: CheckoutModalProps) {
  // Step state - 4 steps when external contact (includes pricing), 3 for internal
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Asset selection
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showKits, setShowKits] = useState(false);
  const [showAssetBrowser, setShowAssetBrowser] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Step 2: Checkout details
  const [custodianType, setCustodianType] = useState<'member' | 'contact'>('member');
  const [custodianId, setCustodianId] = useState('');
  const [custodianContactId, setCustodianContactId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [notes, setNotes] = useState('');

  // Step 3 (external only): Pricing
  const [itemPricing, setItemPricing] = useState<Map<string, ItemPricing>>(new Map());
  const [taxRate, setTaxRate] = useState<string>('0');
  const [paymentOption, setPaymentOption] = useState<'invoice_later' | 'pay_now'>('invoice_later');

  // Computed: total steps (3 for member, 4 for external contact with pricing)
  const totalSteps = custodianType === 'contact' ? 4 : 3;
  const confirmStep = totalSteps; // Last step is always confirm
  const pricingStep = custodianType === 'contact' ? 3 : null; // Step 3 only for contacts

  // Add contact dialog
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState<CreateContactInput>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    company: '',
    job_title: '',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });

  // Add location dialog
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    location_type: 'warehouse',
    address_line1: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US',
  });

  // Refs
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { assets, isLoading: assetsLoading } = useGearAssets({
    orgId,
    search: searchQuery || undefined,
    status: 'available',
    limit: showAssetBrowser ? 100 : 20,
    enabled: isOpen && !showKits && (showAssetBrowser || searchQuery.length >= 2),
  });

  const { instances: kits, isLoading: kitsLoading } = useGearKitInstances(
    showKits ? orgId : null,
    { status: 'available' }
  );

  const { members, isLoading: membersLoading } = useGearOrgMembers(orgId);
  const { locations, createLocation } = useGearLocations(orgId);
  const { contacts, createContact } = useGearContacts(orgId);
  const { lookupAsset } = useGearScanLookup(orgId);
  const { projects, isLoading: projectsLoading } = useProjects({ limit: 100 });
  const { createQuickRental } = useGearRentals(orgId);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedItems([]);
      setScanInput('');
      setSearchQuery('');
      setShowKits(false);
      setShowAssetBrowser(false);
      setScanError(null);
      setCustodianType(getDefaultCustodianType(orgType));
      setCustodianId('');
      setCustodianContactId('');
      setProjectId('');
      setCheckoutDate('');
      setExpectedReturnDate('');
      setDestinationLocationId('');
      setNotes('');
      // Pricing reset
      setItemPricing(new Map());
      setTaxRate('0');
      setPaymentOption('invoice_later');
      // Dialog reset
      setShowAddContact(false);
      setShowAddLocation(false);
      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        job_title: '',
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      });
      setNewLocation({
        name: '',
        location_type: 'warehouse',
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      });
      // Auto-focus scanner input
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [isOpen, orgType]);

  // Handle barcode scan input
  const handleScanSubmit = useCallback(async () => {
    if (!scanInput.trim()) return;
    setScanError(null);

    try {
      const result = await lookupAsset.mutateAsync(scanInput.trim());
      const asset = result.asset as GearAsset;

      if (!asset) {
        setScanError(`No asset found with code: ${scanInput}`);
        return;
      }

      if (asset.status !== 'available') {
        setScanError(`Asset "${asset.name}" is not available (${asset.status})`);
        return;
      }

      // Check if already selected
      if (selectedItems.some((item) => item.id === asset.id)) {
        setScanError(`Asset "${asset.name}" is already selected`);
        return;
      }

      setSelectedItems((prev) => [
        ...prev,
        {
          id: asset.id,
          type: 'asset',
          name: asset.name,
          internalId: asset.internal_id,
          status: asset.status,
          dailyRate: asset.daily_rate,
          weeklyRate: asset.weekly_rate,
          monthlyRate: asset.monthly_rate,
        },
      ]);
      setScanInput('');
    } catch {
      setScanError(`No asset found with code: ${scanInput}`);
    }
  }, [scanInput, lookupAsset, selectedItems]);

  // Handle scan input keypress
  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScanSubmit();
    }
  };

  // Add asset from search results
  const addAsset = (asset: GearAsset) => {
    if (selectedItems.some((item) => item.id === asset.id)) return;
    setSelectedItems((prev) => [
      ...prev,
      {
        id: asset.id,
        type: 'asset',
        name: asset.name,
        internalId: asset.internal_id,
        status: asset.status,
        dailyRate: asset.daily_rate,
        weeklyRate: asset.weekly_rate,
        monthlyRate: asset.monthly_rate,
      },
    ]);
    setSearchQuery('');
  };

  // Add kit (adds all kit assets)
  const addKit = (kit: GearKitInstance) => {
    const kitAssets = kit.contents || [];
    const newItems: SelectedItem[] = [];

    kitAssets.forEach((content: { asset_id: string; asset_name: string; internal_id: string; status: string }) => {
      if (!selectedItems.some((item) => item.id === content.asset_id)) {
        newItems.push({
          id: content.asset_id,
          type: 'asset',
          name: content.asset_name || 'Unknown',
          internalId: content.internal_id || '',
          status: content.status || 'available',
        });
      }
    });

    if (newItems.length > 0) {
      setSelectedItems((prev) => [...prev, ...newItems]);
    }
  };

  // Remove item
  const removeItem = (id: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Handle form submission
  const handleSubmit = async () => {
    const hasCustodian = custodianType === 'member' ? !!custodianId : !!custodianContactId;
    if (selectedItems.length === 0 || !hasCustodian) return;

    const assetIds = selectedItems.map((item) => item.id);

    // For external contacts, use the rental API with pricing
    if (custodianType === 'contact') {
      // Build rental items from pricing
      const rentalItems = Array.from(itemPricing.values()).map((pricing) => ({
        asset_id: pricing.assetId,
        rate_type: pricing.rateType,
        quoted_rate: pricing.rate,
        quantity: pricing.quantity,
        line_total: pricing.lineTotal,
      }));

      await createQuickRental.mutateAsync({
        items: rentalItems,
        contact_id: custodianContactId,
        project_id: projectId || undefined,
        rental_start_date: checkoutDate || format(new Date(), 'yyyy-MM-dd'),
        rental_end_date: expectedReturnDate || format(new Date(), 'yyyy-MM-dd'),
        subtotal,
        tax_rate: parseFloat(taxRate),
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_option: paymentOption,
        destination_location_id: destinationLocationId || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } else {
      // For team members, use the regular checkout
      await onSubmit({
        asset_ids: assetIds,
        custodian_user_id: custodianId,
        project_id: projectId || undefined,
        checkout_at: checkoutDate || undefined,
        expected_return_at: expectedReturnDate || undefined,
        destination_location_id: destinationLocationId || undefined,
        notes: notes.trim() || undefined,
      });
    }
  };

  // Handle adding new contact
  const handleAddContact = async () => {
    if (!newContact.first_name || !newContact.last_name) return;
    try {
      const result = await createContact.mutateAsync(newContact);
      const contact = result.contact;
      setCustodianType('contact');
      setCustodianContactId(contact.id);
      setShowAddContact(false);
      setNewContact({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        company: '',
        job_title: '',
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      });
    } catch (err) {
      console.error('Failed to create contact:', err);
    }
  };

  // Handle adding new location
  const handleAddLocation = async () => {
    if (!newLocation.name) return;
    try {
      const result = await createLocation.mutateAsync(newLocation);
      const location = result.location;
      setDestinationLocationId(location.id);
      setShowAddLocation(false);
      setNewLocation({
        name: '',
        location_type: 'warehouse',
        address_line1: '',
        city: '',
        state: '',
        postal_code: '',
        country: 'US',
      });
    } catch (err) {
      console.error('Failed to create location:', err);
    }
  };

  // Step validation
  const canProceedStep1 = selectedItems.length > 0;
  const canProceedStep2 = custodianType === 'member' ? !!custodianId : !!custodianContactId;

  // Calculate rental days
  const calculateRentalDays = useCallback(() => {
    if (!checkoutDate || !expectedReturnDate) return 1;
    const start = new Date(checkoutDate);
    const end = new Date(expectedReturnDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays);
  }, [checkoutDate, expectedReturnDate]);

  const rentalDays = calculateRentalDays();

  // Initialize pricing when entering pricing step
  const initializePricing = useCallback(() => {
    const newPricing = new Map<string, ItemPricing>();
    selectedItems.forEach((item) => {
      if (item.type === 'asset') {
        const rate = item.dailyRate || 0;
        newPricing.set(item.id, {
          assetId: item.id,
          rateType: 'daily',
          rate: rate,
          quantity: rentalDays,
          lineTotal: rate * rentalDays,
        });
      }
    });
    setItemPricing(newPricing);
  }, [selectedItems, rentalDays]);

  // Update individual item pricing
  const updateItemPricing = (assetId: string, updates: Partial<ItemPricing>) => {
    setItemPricing((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(assetId);
      if (current) {
        const updated = { ...current, ...updates };
        // Recalculate line total
        if (updated.rateType === 'flat') {
          updated.lineTotal = updated.rate;
        } else {
          updated.lineTotal = updated.rate * updated.quantity;
        }
        newMap.set(assetId, updated);
      }
      return newMap;
    });
  };

  // Calculate totals
  const subtotal = Array.from(itemPricing.values()).reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = subtotal * (parseFloat(taxRate) / 100);
  const totalAmount = subtotal + taxAmount;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <PackageOpen className="w-5 h-5 text-accent-yellow" />
            Checkout Assets
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <React.Fragment key={s}>
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    step === s
                      ? 'bg-accent-yellow text-charcoal-black'
                      : step > s
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-muted-gray/20 text-muted-gray'
                  )}
                >
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                {s < totalSteps && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 transition-colors',
                      step > s ? 'bg-green-500/50' : 'bg-muted-gray/20'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-gray mt-1">
            <span>Select Items</span>
            <span>Assign To</span>
            {custodianType === 'contact' && <span>Rental Pricing</span>}
            <span>Confirm</span>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {/* Step 1: Asset Selection */}
          {step === 1 && (
            <div className="h-full flex flex-col gap-4">
              {/* Scanner Input */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Barcode className="w-4 h-4" />
                  Scan Barcode / QR Code
                </Label>
                <div className="flex gap-2">
                  <Input
                    ref={scanInputRef}
                    value={scanInput}
                    onChange={(e) => {
                      setScanInput(e.target.value);
                      setScanError(null);
                    }}
                    onKeyDown={handleScanKeyDown}
                    placeholder="Scan or enter asset code..."
                    className="flex-1"
                    autoComplete="off"
                  />
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

              {/* Browse Options */}
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant={showAssetBrowser ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setShowAssetBrowser(!showAssetBrowser);
                    if (!showAssetBrowser) setShowKits(false);
                  }}
                  className="flex items-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  Browse Assets
                </Button>
                <div className="flex items-center gap-2 ml-auto">
                  <Label className="text-sm text-muted-gray">Kits</Label>
                  <Switch
                    checked={showKits}
                    onCheckedChange={(checked) => {
                      setShowKits(checked);
                      if (checked) setShowAssetBrowser(false);
                    }}
                  />
                </div>
              </div>

              {/* Search / Kit List */}
              <div className="flex-1 min-h-0 flex flex-col">
                {!showKits ? (
                  <>
                    {/* Search input - only show when browsing or for filtering */}
                    {(showAssetBrowser || searchQuery.length > 0) && (
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={showAssetBrowser ? "Filter assets..." : "Search assets by name or ID..."}
                          className="pl-10"
                        />
                      </div>
                    )}
                    {!showAssetBrowser && searchQuery.length < 2 && (
                      <div className="flex-1 flex items-center justify-center text-muted-gray text-sm">
                        <p>Scan a barcode or click "Browse Assets" to select items</p>
                      </div>
                    )}
                    {(showAssetBrowser || searchQuery.length >= 2) && (
                      <ScrollArea className="flex-1 mt-2 border border-muted-gray/30 rounded-lg">
                        {assetsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                          </div>
                        ) : assets.length === 0 ? (
                          <p className="text-center text-muted-gray py-8">No available assets found</p>
                        ) : (
                          <div className="p-2 space-y-1">
                            {assets.map((asset) => {
                              const isSelected = selectedItems.some((i) => i.id === asset.id);
                              return (
                                <button
                                  key={asset.id}
                                  onClick={() => !isSelected && addAsset(asset)}
                                  disabled={isSelected}
                                  className={cn(
                                    'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                                    isSelected
                                      ? 'bg-green-500/10 text-green-400'
                                      : 'hover:bg-charcoal-black/50'
                                  )}
                                >
                                  <Package className="w-4 h-4 text-muted-gray" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{asset.name}</p>
                                    <code className="text-xs text-muted-gray">{asset.internal_id}</code>
                                  </div>
                                  {isSelected && <Check className="w-4 h-4" />}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </ScrollArea>
                    )}
                  </>
                ) : (
                  <ScrollArea className="flex-1 border border-muted-gray/30 rounded-lg">
                    {kitsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                      </div>
                    ) : kits.length === 0 ? (
                      <p className="text-center text-muted-gray py-8">No available kits</p>
                    ) : (
                      <div className="p-2 space-y-2">
                        {kits.map((kit) => (
                          <Card
                            key={kit.id}
                            className="bg-charcoal-black/30 border-muted-gray/30 cursor-pointer hover:border-accent-yellow/50 transition-colors"
                            onClick={() => addKit(kit)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <Package className="w-5 h-5 text-purple-400" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium">{kit.name}</p>
                                  <p className="text-xs text-muted-gray">
                                    {kit.contents?.length || 0} items
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Add Kit
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                )}
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div className="border-t border-muted-gray/30 pt-4">
                  <Label className="mb-2 block">
                    Selected Items ({selectedItems.length})
                  </Label>
                  <ScrollArea className="max-h-32">
                    <div className="flex flex-wrap gap-2">
                      {selectedItems.map((item) => (
                        <Badge
                          key={item.id}
                          variant="secondary"
                          className="flex items-center gap-1 pr-1"
                        >
                          <span className="truncate max-w-[150px]">{item.name}</span>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="ml-1 hover:text-red-400 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Checkout Details */}
          {step === 2 && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Custodian */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Custodian <span className="text-red-400">*</span>
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddContact(true)}
                      className="text-accent-yellow hover:text-accent-yellow/80"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Add Person
                    </Button>
                  </div>

                  {/* Custodian Type Toggle */}
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      variant={custodianType === 'member' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setCustodianType('member');
                        setCustodianContactId('');
                      }}
                    >
                      <User className="w-3 h-3 mr-1" />
                      Team Member
                    </Button>
                    <Button
                      type="button"
                      variant={custodianType === 'contact' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setCustodianType('contact');
                        setCustodianId('');
                      }}
                    >
                      <Building2 className="w-3 h-3 mr-1" />
                      Client Rental
                    </Button>
                  </div>

                  {custodianType === 'member' ? (
                    <Select value={custodianId || "none"} onValueChange={(v) => setCustodianId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a member</SelectItem>
                        {membersLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : (
                          members.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id}>
                              <div className="flex items-center gap-2">
                                <span>{member.display_name || member.email}</span>
                                <Badge variant="outline" className="text-xs">
                                  {member.role}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={custodianContactId || "none"} onValueChange={(v) => setCustodianContactId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a contact</SelectItem>
                        {contacts.length === 0 ? (
                          <div className="px-2 py-4 text-sm text-muted-gray text-center">
                            No contacts yet. Click "Add Person" to create one.
                          </div>
                        ) : (
                          contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                              <div className="flex items-center gap-2">
                                <span>{contact.first_name} {contact.last_name}</span>
                                {contact.company && (
                                  <Badge variant="outline" className="text-xs">
                                    {contact.company}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Project Link */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Link to Project (optional)
                  </Label>
                  <Select value={projectId || "none"} onValueChange={(v) => setProjectId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projectsLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : projects.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-muted-gray text-center">
                          No projects available
                        </div>
                      ) : (
                        projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            <div className="flex items-center gap-2">
                              <span>{project.title}</span>
                              {project.status && (
                                <Badge variant="outline" className="text-xs">
                                  {project.status.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Checkout Date */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Checkout Date
                    </Label>
                    <Input
                      type="date"
                      value={checkoutDate}
                      onChange={(e) => setCheckoutDate(e.target.value)}
                      placeholder="Today if empty"
                    />
                    <p className="text-xs text-muted-gray">Leave empty for today</p>
                  </div>

                  {/* Expected Return Date */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Expected Return
                    </Label>
                    <Input
                      type="date"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      min={checkoutDate || format(new Date(), 'yyyy-MM-dd')}
                    />
                  </div>
                </div>

                {/* Destination Location */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Destination Location (optional)
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddLocation(true)}
                      className="text-accent-yellow hover:text-accent-yellow/80"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Location
                    </Button>
                  </div>
                  <Select value={destinationLocationId || "none"} onValueChange={(v) => setDestinationLocationId(v === "none" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No specific location</SelectItem>
                      {locations.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-muted-gray text-center">
                          No locations yet. Click "Add Location" to create one.
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
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Notes (optional)
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes for this checkout..."
                    rows={3}
                  />
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Step 3: Pricing (External contacts only) */}
          {step === 3 && custodianType === 'contact' && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Rental Period Info */}
                <div className="flex items-center justify-between p-3 bg-charcoal-black/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-gray" />
                    <span className="text-sm">Rental Period</span>
                  </div>
                  <Badge variant="outline">{rentalDays} day{rentalDays !== 1 ? 's' : ''}</Badge>
                </div>

                {/* Item Pricing */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-muted-gray">Item Pricing</Label>
                  {selectedItems.map((item) => {
                    const pricing = itemPricing.get(item.id);
                    return (
                      <Card key={item.id} className="bg-charcoal-black/30 border-muted-gray/30">
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{item.name}</p>
                              <code className="text-xs text-muted-gray">{item.internalId}</code>
                              {item.dailyRate && (
                                <p className="text-xs text-muted-gray mt-1">
                                  Default: ${item.dailyRate.toFixed(2)}/day
                                  {item.weeklyRate && ` | $${item.weeklyRate.toFixed(2)}/week`}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={pricing?.rateType || 'daily'}
                                  onValueChange={(v) => updateItemPricing(item.id, {
                                    rateType: v as 'daily' | 'weekly' | 'flat',
                                    quantity: v === 'flat' ? 1 : rentalDays
                                  })}
                                >
                                  <SelectTrigger className="w-24 h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="daily">Daily</SelectItem>
                                    <SelectItem value="weekly">Weekly</SelectItem>
                                    <SelectItem value="flat">Flat</SelectItem>
                                  </SelectContent>
                                </Select>
                                <div className="relative w-24">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-gray text-sm">$</span>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={pricing?.rate || 0}
                                    onChange={(e) => updateItemPricing(item.id, { rate: parseFloat(e.target.value) || 0 })}
                                    className="pl-6 h-8 text-right"
                                  />
                                </div>
                              </div>
                              <p className="text-sm font-medium text-accent-yellow">
                                ${(pricing?.lineTotal || 0).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Tax Rate */}
                <div className="flex items-center gap-4 p-3 bg-charcoal-black/30 rounded-lg">
                  <Label className="text-sm">Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-24 h-8"
                  />
                </div>

                {/* Payment Option */}
                <div className="p-3 bg-charcoal-black/30 rounded-lg">
                  <Label className="text-sm mb-2 block">Payment Option</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={paymentOption === 'invoice_later' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentOption('invoice_later')}
                    >
                      Invoice Later
                    </Button>
                    <Button
                      type="button"
                      variant={paymentOption === 'pay_now' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setPaymentOption('pay_now')}
                    >
                      Pay at Checkout
                    </Button>
                  </div>
                </div>

                {/* Totals */}
                <Card className="bg-charcoal-black/50 border-accent-yellow/30">
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-gray">Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-gray">Tax ({taxRate}%)</span>
                        <span>${taxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-lg font-semibold border-t border-muted-gray/30 pt-2">
                        <span>Total</span>
                        <span className="text-accent-yellow">${totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}

          {/* Confirmation Step (Step 3 for members, Step 4 for contacts) */}
          {step === confirmStep && (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <Card className="bg-charcoal-black/30 border-muted-gray/30">
                  <CardContent className="p-4 space-y-4">
                    {/* Items Summary */}
                    <div>
                      <Label className="text-muted-gray">Items to Checkout</Label>
                      <div className="mt-2 space-y-1">
                        {selectedItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 text-sm"
                          >
                            <Package className="w-3 h-3 text-muted-gray" />
                            <span>{item.name}</span>
                            <code className="text-xs text-muted-gray">
                              ({item.internalId})
                            </code>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-muted-gray/30 pt-4 grid grid-cols-2 gap-4">
                      {/* Custodian */}
                      <div>
                        <Label className="text-muted-gray text-xs">Custodian</Label>
                        <p className="text-sm">
                          {custodianType === 'member' ? (
                            members.find((m) => m.user_id === custodianId)?.display_name ||
                            members.find((m) => m.user_id === custodianId)?.email ||
                            'Unknown'
                          ) : (
                            (() => {
                              const contact = contacts.find((c) => c.id === custodianContactId);
                              return contact ? `${contact.first_name} ${contact.last_name}` : 'Unknown';
                            })()
                          )}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {custodianType === 'member' ? 'Team Member' : 'Client Rental'}
                        </Badge>
                      </div>

                      {/* Checkout Date */}
                      <div>
                        <Label className="text-muted-gray text-xs">Checkout Date</Label>
                        <p className="text-sm">
                          {checkoutDate
                            ? format(new Date(checkoutDate), 'MMM d, yyyy')
                            : 'Today'}
                        </p>
                      </div>

                      {/* Return Date */}
                      {expectedReturnDate && (
                        <div>
                          <Label className="text-muted-gray text-xs">Expected Return</Label>
                          <p className="text-sm">
                            {format(new Date(expectedReturnDate), 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}

                      {/* Location */}
                      {destinationLocationId && (
                        <div>
                          <Label className="text-muted-gray text-xs">Destination</Label>
                          <p className="text-sm">
                            {locations.find((l) => l.id === destinationLocationId)?.name}
                          </p>
                        </div>
                      )}

                      {/* Project */}
                      {projectId && (
                        <div>
                          <Label className="text-muted-gray text-xs">Project</Label>
                          <p className="text-sm">
                            {projects.find((p) => p.id === projectId)?.title || projectId}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Notes */}
                    {notes && (
                      <div className="border-t border-muted-gray/30 pt-4">
                        <Label className="text-muted-gray text-xs">Notes</Label>
                        <p className="text-sm mt-1">{notes}</p>
                      </div>
                    )}

                    {/* Pricing Summary (External contacts only) */}
                    {custodianType === 'contact' && (
                      <div className="border-t border-muted-gray/30 pt-4">
                        <Label className="text-muted-gray text-xs mb-2 block">Pricing</Label>
                        <div className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-gray">Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-gray">Tax ({taxRate}%)</span>
                            <span>${taxAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span className="text-accent-yellow">${totalAmount.toFixed(2)}</span>
                          </div>
                          <Badge variant="outline" className="mt-2">
                            {paymentOption === 'invoice_later' ? 'Invoice Later' : 'Pay at Checkout'}
                          </Badge>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-muted-gray/30">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (step === 1) {
                onClose();
              } else {
                setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
              }
            }}
          >
            {step === 1 ? (
              'Cancel'
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </>
            )}
          </Button>

          {step < confirmStep ? (
            <Button
              type="button"
              onClick={() => {
                // Initialize pricing when entering pricing step (step 3 for contacts)
                if (step === 2 && custodianType === 'contact') {
                  initializePricing();
                }
                setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
              }}
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || createQuickRental.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isSubmitting || createQuickRental.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {custodianType === 'contact' ? 'Create Rental' : 'Complete Checkout'}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-accent-yellow" />
              Add New Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name <span className="text-red-400">*</span></Label>
                <Input
                  value={newContact.first_name}
                  onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name <span className="text-red-400">*</span></Label>
                <Input
                  value={newContact.last_name}
                  onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newContact.email || ''}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  type="tel"
                  value={newContact.phone || ''}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={newContact.company || ''}
                  onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                  placeholder="Company Name"
                />
              </div>
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input
                  value={newContact.job_title || ''}
                  onChange={(e) => setNewContact({ ...newContact, job_title: e.target.value })}
                  placeholder="Director"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={newContact.address_line1 || ''}
                onChange={(e) => setNewContact({ ...newContact, address_line1: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={newContact.city || ''}
                  onChange={(e) => setNewContact({ ...newContact, city: e.target.value })}
                  placeholder="Los Angeles"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={newContact.state || ''}
                  onChange={(e) => setNewContact({ ...newContact, state: e.target.value })}
                  placeholder="CA"
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <Input
                  value={newContact.postal_code || ''}
                  onChange={(e) => setNewContact({ ...newContact, postal_code: e.target.value })}
                  placeholder="90001"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddContact(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddContact}
              disabled={!newContact.first_name || !newContact.last_name || createContact.isPending}
            >
              {createContact.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Add Contact
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Location Dialog */}
      <Dialog open={showAddLocation} onOpenChange={setShowAddLocation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-accent-yellow" />
              Add New Location
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Location Name <span className="text-red-400">*</span></Label>
              <Input
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="Main Warehouse"
              />
            </div>
            <div className="space-y-2">
              <Label>Location Type</Label>
              <Select
                value={newLocation.location_type}
                onValueChange={(v) => setNewLocation({ ...newLocation, location_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="warehouse">Warehouse</SelectItem>
                  <SelectItem value="office">Office</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="set">Set Location</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={newLocation.address_line1}
                onChange={(e) => setNewLocation({ ...newLocation, address_line1: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={newLocation.city}
                  onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                  placeholder="Los Angeles"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={newLocation.state}
                  onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                  placeholder="CA"
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP Code</Label>
                <Input
                  value={newLocation.postal_code}
                  onChange={(e) => setNewLocation({ ...newLocation, postal_code: e.target.value })}
                  placeholder="90001"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddLocation(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLocation}
              disabled={!newLocation.name || createLocation.isPending}
            >
              {createLocation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Add Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
