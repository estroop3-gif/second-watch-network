/**
 * Checkout Dialog
 * Single-page accordion checkout with Team/Client mode toggle
 * Includes optional verification flow based on organization settings
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Package,
  User,
  Building2,
  Loader2,
  Check,
  ScanBarcode,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

import { ItemsSection } from './ItemsSection';
import { AssignmentSection } from './AssignmentSection';
import { PricingSection } from './PricingSection';
import { VerificationScreen } from './VerificationScreen';

import {
  useGearOrgMembers,
  useGearLocations,
  useGearContacts,
  useGearTransactions,
  useGearRentals,
  useGearOrgSettings,
} from '@/hooks/gear';
import {
  useVerificationSessions,
  useVerificationSession,
} from '@/hooks/gear/useGearVerification';
// Projects are now loaded dynamically in AssignmentSection based on selected custodian
import type { OrganizationType, GearAsset, VerificationItem } from '@/types/gear';

// Types
export interface SelectedItem {
  id: string;
  type: 'asset' | 'kit';
  name: string;
  internalId: string;
  status: string;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  // Kit tracking - if this item was added as part of a kit
  fromKitId?: string;
  fromKitName?: string;
}

export interface ItemPricing {
  assetId: string;
  rateType: 'daily' | 'weekly' | 'flat';
  rate: number;
  quantity: number;
  lineTotal: number;
}

interface CheckoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  orgType?: OrganizationType;
}

export function CheckoutDialog({
  isOpen,
  onClose,
  orgId,
  orgType,
}: CheckoutDialogProps) {
  // Mode state - Team Checkout vs Client Rental
  const [mode, setMode] = useState<'team' | 'client'>(() => {
    if (orgType === 'rental_house') return 'client';
    return 'team';
  });

  // Items state
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Assignment state
  const [custodianId, setCustodianId] = useState('');
  const [custodianContactId, setCustodianContactId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [checkoutDate, setCheckoutDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [notes, setNotes] = useState('');

  // Pricing state (Client mode only)
  const [itemPricing, setItemPricing] = useState<Map<string, ItemPricing>>(new Map());
  const [taxRate, setTaxRate] = useState('0');
  const [paymentOption, setPaymentOption] = useState<'invoice_later' | 'pay_now'>('invoice_later');

  // Accordion state
  const [expandedSections, setExpandedSections] = useState<string[]>(['items']);

  // Verification state
  const [showVerification, setShowVerification] = useState(false);
  const [verificationSessionId, setVerificationSessionId] = useState<string | null>(null);
  const [verificationItems, setVerificationItems] = useState<VerificationItem[]>([]);
  const [pendingCheckoutData, setPendingCheckoutData] = useState<{
    assetIds: string[];
    rentalItems?: Array<{
      asset_id: string;
      rate_type: string;
      quoted_rate: number;
      quantity: number;
      line_total: number;
    }>;
  } | null>(null);

  // Scanner ref for focus management
  const scannerRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { members } = useGearOrgMembers(orgId);
  const { locations, refetch: refetchLocations } = useGearLocations(orgId);
  const { contacts, createContact } = useGearContacts(orgId);
  const { quickCheckout } = useGearTransactions({ orgId });
  const { createQuickRental } = useGearRentals(orgId);
  const { settings: orgSettings } = useGearOrgSettings(orgId);

  // Verification hooks
  const { createSession } = useVerificationSessions({ orgId });
  const {
    session: verificationSession,
    verifyItem,
    reportDiscrepancy,
    acknowledgeDiscrepancies,
    completeVerification,
  } = useVerificationSession(orgId, verificationSessionId);

  // Determine verification requirements based on mode and settings
  const verificationRequired = mode === 'client'
    ? orgSettings?.client_checkout_verification_required
    : orgSettings?.team_checkout_verification_required;
  const verifyMethod = mode === 'client'
    ? orgSettings?.client_checkout_verify_method || 'scan_or_checkoff'
    : orgSettings?.team_checkout_verify_method || 'scan_or_checkoff';
  const discrepancyAction = mode === 'client'
    ? orgSettings?.client_checkout_discrepancy_action || 'warn'
    : orgSettings?.team_checkout_discrepancy_action || 'warn';
  const kitVerification = mode === 'client'
    ? orgSettings?.client_checkout_kit_verification || 'kit_only'
    : orgSettings?.team_checkout_kit_verification || 'kit_only';

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode(orgType === 'rental_house' ? 'client' : 'team');
      setSelectedItems([]);
      setCustodianId('');
      setCustodianContactId('');
      setProjectId('');
      setCheckoutDate('');
      setExpectedReturnDate('');
      setDestinationLocationId('');
      setNotes('');
      setItemPricing(new Map());
      setTaxRate('0');
      setPaymentOption('invoice_later');
      setExpandedSections(['items']);
      // Reset verification state
      setShowVerification(false);
      setVerificationSessionId(null);
      setVerificationItems([]);
      setPendingCheckoutData(null);
      // Focus scanner after a brief delay
      setTimeout(() => scannerRef.current?.focus(), 100);
    }
  }, [isOpen, orgType]);

  // Auto-expand assignment when items are added
  useEffect(() => {
    if (selectedItems.length > 0 && !expandedSections.includes('assignment')) {
      setExpandedSections((prev) => [...prev, 'assignment']);
    }
  }, [selectedItems.length, expandedSections]);

  // Initialize pricing when entering client mode or adding items
  const initializePricing = useCallback(() => {
    const rentalDays = calculateRentalDays();
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
  }, [selectedItems]);

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

  // Update pricing when dates change
  useEffect(() => {
    if (mode === 'client' && selectedItems.length > 0) {
      initializePricing();
    }
  }, [mode, selectedItems.length, rentalDays, initializePricing]);

  // Calculate totals
  const subtotal = Array.from(itemPricing.values()).reduce((sum, item) => sum + item.lineTotal, 0);
  const taxAmount = subtotal * (parseFloat(taxRate) / 100);
  const totalAmount = subtotal + taxAmount;

  // Add item callback
  const handleAddItem = useCallback((item: SelectedItem) => {
    setSelectedItems((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
    // Refocus scanner
    setTimeout(() => scannerRef.current?.focus(), 50);
  }, []);

  // Remove item callback
  const handleRemoveItem = useCallback((id: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Update item pricing
  const handleUpdatePricing = useCallback((assetId: string, updates: Partial<ItemPricing>) => {
    setItemPricing((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(assetId);
      if (current) {
        const updated = { ...current, ...updates };
        if (updated.rateType === 'flat') {
          updated.lineTotal = updated.rate;
        } else {
          updated.lineTotal = updated.rate * updated.quantity;
        }
        newMap.set(assetId, updated);
      }
      return newMap;
    });
  }, []);

  // Validation
  const hasCustodian = mode === 'team' ? !!custodianId : !!custodianContactId;
  const canSubmit = selectedItems.length > 0 && hasCustodian;

  // Prepare verification items from selected items
  const prepareVerificationItems = useCallback((): VerificationItem[] => {
    return selectedItems.map((item) => ({
      id: item.id,
      type: item.type,
      name: item.name,
      internal_id: item.internalId,
      status: 'pending' as const,
    }));
  }, [selectedItems]);

  // Start verification flow
  const startVerification = async () => {
    const items = prepareVerificationItems();
    setVerificationItems(items);

    // Store checkout data for after verification
    const assetIds = selectedItems.map((item) => item.id);
    if (mode === 'client') {
      const rentalItems = Array.from(itemPricing.values()).map((pricing) => ({
        asset_id: pricing.assetId,
        rate_type: pricing.rateType,
        quoted_rate: pricing.rate,
        quantity: pricing.quantity,
        line_total: pricing.lineTotal,
      }));
      setPendingCheckoutData({ assetIds, rentalItems });
    } else {
      setPendingCheckoutData({ assetIds });
    }

    setShowVerification(true);
  };

  // Complete checkout after verification
  const completeCheckout = async () => {
    if (!pendingCheckoutData) {
      throw new Error('No checkout data available. Please try again.');
    }

    if (mode === 'client' && pendingCheckoutData.rentalItems) {
      await createQuickRental.mutateAsync({
        items: pendingCheckoutData.rentalItems,
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
    } else {
      await quickCheckout.mutateAsync({
        asset_ids: pendingCheckoutData.assetIds,
        custodian_user_id: custodianId,
        project_id: projectId || undefined,
        checkout_at: checkoutDate || undefined,
        expected_return_at: expectedReturnDate || undefined,
        destination_location_id: destinationLocationId || undefined,
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  // Handle verification item verification
  const handleVerifyItem = async (itemId: string, method: 'scan' | 'checkoff') => {
    // Update local state optimistically
    setVerificationItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: 'verified' as const } : item
      )
    );
  };

  // Handle discrepancy report
  const handleReportDiscrepancy = async (itemId: string, issueType: string, notes?: string) => {
    // Update local state
    setVerificationItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, status: 'discrepancy' as const } : item
      )
    );
  };

  // Handle verification completion
  const handleVerificationComplete = async () => {
    try {
      await completeCheckout();
      // Close verification screen after successful checkout
      setShowVerification(false);
    } catch (error) {
      console.error('Checkout after verification failed:', error);
      // Re-throw so VerificationScreen can display the error
      throw error;
    }
  };

  // Close verification and return to checkout form
  const handleVerificationClose = () => {
    setShowVerification(false);
    setVerificationSessionId(null);
    setVerificationItems([]);
    setPendingCheckoutData(null);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!canSubmit) return;

    // If verification is required, start verification flow
    if (verificationRequired) {
      await startVerification();
      return;
    }

    // Otherwise, proceed with checkout directly
    const assetIds = selectedItems.map((item) => item.id);

    if (mode === 'client') {
      // Client Rental - use rental API
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
    } else {
      // Team Checkout - use quick checkout API
      await quickCheckout.mutateAsync({
        asset_ids: assetIds,
        custodian_user_id: custodianId,
        project_id: projectId || undefined,
        checkout_at: checkoutDate || undefined,
        expected_return_at: expectedReturnDate || undefined,
        destination_location_id: destinationLocationId || undefined,
        notes: notes.trim() || undefined,
      });
    }

    onClose();
  };

  const isSubmitting = quickCheckout.isPending || createQuickRental.isPending;

  // Get custodian display name for submit button
  const getCustodianName = () => {
    if (mode === 'team' && custodianId) {
      const member = members.find((m) => m.user_id === custodianId);
      return member?.display_name || member?.email || 'selected member';
    }
    if (mode === 'client' && custodianContactId) {
      const contact = contacts.find((c) => c.id === custodianContactId);
      return contact ? `${contact.first_name} ${contact.last_name}` : 'selected client';
    }
    return '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with Mode Toggle */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-muted-gray/30">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-accent-yellow" />
              <span>Checkout Assets</span>
            </div>
          </DialogTitle>
          {/* Mode Toggle */}
          <div className="flex gap-2 mt-3">
            <Button
              type="button"
              variant={mode === 'team' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('team')}
              className={cn(
                mode === 'team' && 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
              )}
            >
              <User className="w-4 h-4 mr-2" />
              Team Checkout
            </Button>
            <Button
              type="button"
              variant={mode === 'client' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('client')}
              className={cn(
                mode === 'client' && 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Client Rental
            </Button>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <Accordion
            type="multiple"
            value={expandedSections}
            onValueChange={setExpandedSections}
            className="space-y-4"
          >
            {/* Items Section */}
            <AccordionItem value="items" className="border border-muted-gray/30 rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-charcoal-black/30">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent-yellow" />
                  <span className="font-medium">Items</span>
                  {selectedItems.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {selectedItems.length}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <ItemsSection
                  orgId={orgId}
                  selectedItems={selectedItems}
                  onAddItem={handleAddItem}
                  onRemoveItem={handleRemoveItem}
                  scannerRef={scannerRef}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Assignment Section */}
            <AccordionItem value="assignment" className="border border-muted-gray/30 rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-charcoal-black/30">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-accent-yellow" />
                  <span className="font-medium">Assign To</span>
                  <span className="text-red-400">*</span>
                  {hasCustodian && (
                    <Badge variant="secondary" className="ml-2 bg-green-500/20 text-green-400">
                      <Check className="w-3 h-3 mr-1" />
                      Set
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 pt-2">
                <AssignmentSection
                  mode={mode}
                  orgId={orgId}
                  custodianId={custodianId}
                  setCustodianId={setCustodianId}
                  custodianContactId={custodianContactId}
                  setCustodianContactId={setCustodianContactId}
                  projectId={projectId}
                  setProjectId={setProjectId}
                  checkoutDate={checkoutDate}
                  setCheckoutDate={setCheckoutDate}
                  expectedReturnDate={expectedReturnDate}
                  setExpectedReturnDate={setExpectedReturnDate}
                  destinationLocationId={destinationLocationId}
                  setDestinationLocationId={setDestinationLocationId}
                  notes={notes}
                  setNotes={setNotes}
                  members={members}
                  contacts={contacts}
                  locations={locations}
                  createContact={createContact}
                  onLocationsChange={refetchLocations}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Pricing Section (Client mode only) */}
            {mode === 'client' && (
              <AccordionItem value="pricing" className="border border-blue-500/30 rounded-lg overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-blue-500/5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400" />
                    <span className="font-medium">Rental Pricing</span>
                    {totalAmount > 0 && (
                      <Badge variant="secondary" className="ml-2 bg-blue-500/20 text-blue-400">
                        ${totalAmount.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <PricingSection
                    selectedItems={selectedItems}
                    itemPricing={itemPricing}
                    onUpdatePricing={handleUpdatePricing}
                    rentalDays={rentalDays}
                    taxRate={taxRate}
                    setTaxRate={setTaxRate}
                    paymentOption={paymentOption}
                    setPaymentOption={setPaymentOption}
                    subtotal={subtotal}
                    taxAmount={taxAmount}
                    totalAmount={totalAmount}
                  />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-muted-gray/30 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={cn(
              mode === 'team'
                ? 'bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : verificationRequired ? (
              <>
                <ScanBarcode className="w-4 h-4 mr-2" />
                Verify & Checkout
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                {mode === 'team'
                  ? `Checkout ${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''}`
                  : `Create Rental`}
                {hasCustodian && ` to ${getCustodianName()}`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>

      {/* Verification Screen */}
      <VerificationScreen
        isOpen={showVerification}
        onClose={handleVerificationClose}
        orgId={orgId}
        verificationType="sender"
        items={verificationItems}
        verifyMethod={verifyMethod as 'scan_only' | 'scan_or_checkoff'}
        discrepancyAction={discrepancyAction as 'block' | 'warn'}
        kitVerification={kitVerification as 'kit_only' | 'verify_contents'}
        onVerifyItem={handleVerifyItem}
        onReportDiscrepancy={handleReportDiscrepancy}
        onComplete={handleVerificationComplete}
        verifiedItems={verificationItems.filter((i) => i.status === 'verified').map((i) => ({
          ...i,
          verified_at: new Date().toISOString(),
        }))}
        discrepancies={verificationItems
          .filter((i) => i.status === 'discrepancy')
          .map((i) => ({ item_id: i.id, issue_type: 'unknown', notes: '' }))}
        isLoading={isSubmitting}
      />
    </Dialog>
  );
}
