/**
 * Work Order Dialog Component
 * Create and edit work orders
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Loader2, Calendar as CalendarIcon, User, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type {
  GearWorkOrder,
  CreateWorkOrderInput,
  UpdateWorkOrderInput,
} from '@/types/gear';
import { useWorkOrderMutations } from '@/hooks/gear/useGearWorkOrders';
import { useGearOrgMembers, useGearClientContacts } from '@/hooks/gear/useGearHouse';
import { ItemsSection } from '@/components/gear/checkout/ItemsSection';
import type { SelectedItem } from '@/components/gear/checkout/CheckoutDialog';

interface WorkOrderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  workOrder?: GearWorkOrder | null;
  onSuccess?: (workOrder: GearWorkOrder) => void;
}

export function WorkOrderDialog({
  isOpen,
  onClose,
  orgId,
  workOrder,
  onSuccess,
}: WorkOrderDialogProps) {
  const isEditing = !!workOrder;

  // Refs
  const scannerRef = useRef<HTMLInputElement>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [custodianType, setCustodianType] = useState<'user' | 'contact'>('user');
  const [custodianUserId, setCustodianUserId] = useState<string>('');
  const [custodianContactId, setCustodianContactId] = useState<string>('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [pickupDate, setPickupDate] = useState<Date | undefined>();
  const [expectedReturnDate, setExpectedReturnDate] = useState<Date | undefined>();
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Hooks
  const { members } = useGearOrgMembers(orgId);
  const { contacts } = useGearClientContacts(orgId);
  const { createWorkOrder, updateWorkOrder } = useWorkOrderMutations(orgId);

  // Initialize form from existing work order
  useEffect(() => {
    if (workOrder) {
      setTitle(workOrder.title || '');
      setNotes(workOrder.notes || '');
      setAssignedTo(workOrder.assigned_to || '');
      if (workOrder.custodian_user_id) {
        setCustodianType('user');
        setCustodianUserId(workOrder.custodian_user_id);
      } else if (workOrder.custodian_contact_id) {
        setCustodianType('contact');
        setCustodianContactId(workOrder.custodian_contact_id);
      }
      setDueDate(workOrder.due_date ? new Date(workOrder.due_date) : undefined);
      setPickupDate(workOrder.pickup_date ? new Date(workOrder.pickup_date) : undefined);
      setExpectedReturnDate(workOrder.expected_return_date ? new Date(workOrder.expected_return_date) : undefined);
      // Items would be loaded separately if editing
      if (workOrder.items) {
        setSelectedItems(workOrder.items.map(item => ({
          id: item.asset_id || item.kit_instance_id || '',
          type: 'asset' as const,
          name: item.asset_name || item.kit_name || '',
          internalId: item.asset_internal_id || '',
          status: 'available',
        })));
      }
    } else {
      // Reset form for new work order
      setTitle('');
      setNotes('');
      setAssignedTo('');
      setCustodianType('user');
      setCustodianUserId('');
      setCustodianContactId('');
      setDueDate(undefined);
      setPickupDate(undefined);
      setExpectedReturnDate(undefined);
      setSelectedItems([]);
    }
  }, [workOrder, isOpen]);

  // Handle submit
  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      if (isEditing && workOrder) {
        const input: UpdateWorkOrderInput = {
          title: title.trim(),
          notes: notes.trim() || undefined,
          assigned_to: assignedTo || undefined,
          custodian_user_id: custodianType === 'user' && custodianUserId ? custodianUserId : undefined,
          custodian_contact_id: custodianType === 'contact' && custodianContactId ? custodianContactId : undefined,
          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
          pickup_date: pickupDate ? format(pickupDate, 'yyyy-MM-dd') : undefined,
          expected_return_date: expectedReturnDate ? format(expectedReturnDate, 'yyyy-MM-dd') : undefined,
        };
        const result = await updateWorkOrder.mutateAsync({
          workOrderId: workOrder.id,
          input,
        });
        onSuccess?.(result.work_order);
      } else {
        const input: CreateWorkOrderInput = {
          title: title.trim(),
          notes: notes.trim() || undefined,
          assigned_to: assignedTo || undefined,
          custodian_user_id: custodianType === 'user' && custodianUserId ? custodianUserId : undefined,
          custodian_contact_id: custodianType === 'contact' && custodianContactId ? custodianContactId : undefined,
          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : undefined,
          pickup_date: pickupDate ? format(pickupDate, 'yyyy-MM-dd') : undefined,
          expected_return_date: expectedReturnDate ? format(expectedReturnDate, 'yyyy-MM-dd') : undefined,
          items: selectedItems.map(item => ({
            asset_id: item.type === 'asset' ? item.id : undefined,
            kit_instance_id: item.type === 'kit' ? item.id : undefined,
          })),
        };
        const result = await createWorkOrder.mutateAsync(input);
        onSuccess?.(result.work_order);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save work order:', error);
    }
  };

  // Item handlers for ItemsSection
  const handleAddItem = (item: SelectedItem) => {
    if (!selectedItems.find(i => i.id === item.id)) {
      setSelectedItems(prev => [...prev, item]);
    }
  };

  const handleRemoveItem = (itemId: string) => {
    setSelectedItems(prev => prev.filter(i => i.id !== itemId));
  };

  const isLoading = createWorkOrder.isPending || updateWorkOrder.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">
            {isEditing ? 'Edit Work Order' : 'Create Work Order'}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            {isEditing
              ? 'Update work order details'
              : 'Create a new work order for pre-checkout staging'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekend Shoot Prep, Camera Package A"
              className="bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          {/* Custodian */}
          <div className="space-y-2">
            <Label>Equipment For</Label>
            <div className="flex gap-2">
              <Select value={custodianType} onValueChange={(v) => setCustodianType(v as 'user' | 'contact')}>
                <SelectTrigger className="w-[140px] bg-charcoal-black/50 border-muted-gray/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/30">
                  <SelectItem value="user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Team Member
                    </div>
                  </SelectItem>
                  <SelectItem value="contact">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Contact
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {custodianType === 'user' ? (
                <Select
                  value={custodianUserId || '__none__'}
                  onValueChange={(v) => setCustodianUserId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="flex-1 bg-charcoal-black/50 border-muted-gray/30">
                    <SelectValue placeholder="Select team member..." />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal-black border-muted-gray/30">
                    <SelectItem value="__none__">None</SelectItem>
                    {members?.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.display_name || member.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={custodianContactId || '__none__'}
                  onValueChange={(v) => setCustodianContactId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="flex-1 bg-charcoal-black/50 border-muted-gray/30">
                    <SelectValue placeholder="Select contact..." />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal-black border-muted-gray/30">
                    <SelectItem value="__none__">None</SelectItem>
                    {contacts?.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name}
                        {contact.company && ` (${contact.company})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label>Assign Preparer</Label>
            <Select
              value={assignedTo || '__none__'}
              onValueChange={(v) => setAssignedTo(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30">
                <SelectValue placeholder="Select who will prepare this..." />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/30">
                <SelectItem value="__none__">Unassigned</SelectItem>
                {members?.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.display_name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-charcoal-black/50 border-muted-gray/30",
                      !dueDate && "text-muted-gray"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, 'MMM d, yyyy') : 'Select...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-charcoal-black border-muted-gray/30">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Pickup Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-charcoal-black/50 border-muted-gray/30",
                      !pickupDate && "text-muted-gray"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {pickupDate ? format(pickupDate, 'MMM d, yyyy') : 'Select...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-charcoal-black border-muted-gray/30">
                  <Calendar
                    mode="single"
                    selected={pickupDate}
                    onSelect={setPickupDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Expected Return</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal bg-charcoal-black/50 border-muted-gray/30",
                      !expectedReturnDate && "text-muted-gray"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {expectedReturnDate ? format(expectedReturnDate, 'MMM d, yyyy') : 'Select...'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-charcoal-black border-muted-gray/30">
                  <Calendar
                    mode="single"
                    selected={expectedReturnDate}
                    onSelect={setExpectedReturnDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Items - uses same selection as checkout */}
          {!isEditing && (
            <div className="space-y-2">
              <Label>Equipment</Label>
              <ItemsSection
                orgId={orgId}
                selectedItems={selectedItems}
                onAddItem={handleAddItem}
                onRemoveItem={handleRemoveItem}
                scannerRef={scannerRef}
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              className="bg-charcoal-black/50 border-muted-gray/30 min-h-[80px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !title.trim()}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? 'Save Changes' : 'Create Work Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkOrderDialog;
