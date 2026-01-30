/**
 * DealMemoDialog - Create/Edit deal memos for crew members
 *
 * Used when moving an application to "offered" status to capture
 * rate details and terms before sending for signature.
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useDealMemoMutations } from '@/hooks/backlot';
import type { DealMemo, DealMemoInput, DealMemoRateType, BacklotProfile } from '@/types/backlot';
import {
  DollarSign,
  Clock,
  Calendar,
  Car,
  Phone,
  Briefcase,
  Loader2,
  FileText,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';

interface DealMemoDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  // Pre-fill data from application
  userId?: string;
  userProfile?: BacklotProfile | null;
  roleId?: string;
  roleTitle?: string;
  // Edit mode
  existingMemo?: DealMemo | null;
  onSuccess?: (memo: DealMemo) => void;
}

const RATE_TYPE_OPTIONS: { value: DealMemoRateType; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'flat', label: 'Flat Rate' },
];

const RATE_TYPE_SUFFIX: Record<DealMemoRateType, string> = {
  hourly: '/hr',
  daily: '/day',
  weekly: '/wk',
  flat: ' total',
};

export function DealMemoDialog({
  open,
  onClose,
  projectId,
  userId,
  userProfile,
  roleId,
  roleTitle,
  existingMemo,
  onSuccess,
}: DealMemoDialogProps) {
  const { createDealMemo, updateDealMemo } = useDealMemoMutations(projectId);
  const isEditing = !!existingMemo;

  // Form state
  const [formData, setFormData] = useState<{
    position_title: string;
    rate_type: DealMemoRateType;
    rate_amount: string;
    overtime_multiplier: string;
    double_time_multiplier: string;
    kit_rental_rate: string;
    car_allowance: string;
    phone_allowance: string;
    per_diem_rate: string;
    start_date: string;
    end_date: string;
    notes: string;
    template_type: 'crew' | 'talent';
    performer_category: string;
    usage_rights: string;
    signer_name: string;
    signer_email: string;
  }>({
    position_title: '',
    rate_type: 'daily',
    rate_amount: '',
    overtime_multiplier: '1.5',
    double_time_multiplier: '2.0',
    kit_rental_rate: '',
    car_allowance: '',
    phone_allowance: '',
    per_diem_rate: '',
    start_date: '',
    end_date: '',
    notes: '',
    template_type: 'crew',
    performer_category: '',
    usage_rights: '',
    signer_name: '',
    signer_email: '',
  });

  // Initialize form with existing data or defaults
  useEffect(() => {
    if (existingMemo) {
      setFormData({
        position_title: existingMemo.position_title || '',
        rate_type: existingMemo.rate_type || 'daily',
        rate_amount: existingMemo.rate_amount?.toString() || '',
        overtime_multiplier: existingMemo.overtime_multiplier?.toString() || '1.5',
        double_time_multiplier: existingMemo.double_time_multiplier?.toString() || '2.0',
        kit_rental_rate: existingMemo.kit_rental_rate?.toString() || '',
        car_allowance: existingMemo.car_allowance?.toString() || '',
        phone_allowance: existingMemo.phone_allowance?.toString() || '',
        per_diem_rate: existingMemo.per_diem_rate?.toString() || '',
        start_date: existingMemo.start_date || '',
        end_date: existingMemo.end_date || '',
        notes: existingMemo.notes || '',
        template_type: existingMemo.template_type || 'crew',
        performer_category: existingMemo.performer_category || '',
        usage_rights: existingMemo.usage_rights ? JSON.stringify(existingMemo.usage_rights) : '',
        signer_name: existingMemo.signer_name || '',
        signer_email: existingMemo.signer_email || '',
      });
    } else if (roleTitle) {
      setFormData(prev => ({
        ...prev,
        position_title: roleTitle,
      }));
    }
  }, [existingMemo, roleTitle, open]);

  const handleSubmit = async () => {
    if (!formData.position_title.trim()) {
      toast.error('Position title is required');
      return;
    }
    if (!formData.rate_amount || parseFloat(formData.rate_amount) <= 0) {
      toast.error('Rate amount is required');
      return;
    }

    const targetUserId = existingMemo?.user_id || userId;
    if (!targetUserId) {
      toast.error('User is required');
      return;
    }

    const input: DealMemoInput = {
      user_id: targetUserId,
      role_id: existingMemo?.role_id || roleId || null,
      position_title: formData.position_title.trim(),
      rate_type: formData.rate_type,
      rate_amount: parseFloat(formData.rate_amount),
      overtime_multiplier: parseFloat(formData.overtime_multiplier) || 1.5,
      double_time_multiplier: parseFloat(formData.double_time_multiplier) || 2.0,
      kit_rental_rate: formData.kit_rental_rate ? parseFloat(formData.kit_rental_rate) : null,
      car_allowance: formData.car_allowance ? parseFloat(formData.car_allowance) : null,
      phone_allowance: formData.phone_allowance ? parseFloat(formData.phone_allowance) : null,
      per_diem_rate: formData.per_diem_rate ? parseFloat(formData.per_diem_rate) : null,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      notes: formData.notes.trim() || null,
      template_type: formData.template_type,
      performer_category: formData.template_type === 'talent' && formData.performer_category ? formData.performer_category : null,
      usage_rights: formData.template_type === 'talent' && formData.usage_rights ? JSON.parse(formData.usage_rights || '{}') : null,
      signer_name: formData.signer_name.trim() || null,
      signer_email: formData.signer_email.trim() || null,
    };

    try {
      if (isEditing && existingMemo) {
        const result = await updateDealMemo.mutateAsync({ id: existingMemo.id, ...input });
        toast.success('Deal memo updated');
        onSuccess?.(result.deal_memo);
      } else {
        const result = await createDealMemo.mutateAsync(input);
        toast.success('Deal memo created');
        onSuccess?.(result.deal_memo);
      }
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save deal memo');
    }
  };

  const displayUser = existingMemo?.user || userProfile;
  const isPending = createDealMemo.isPending || updateDealMemo.isPending;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditing ? 'Edit Deal Memo' : 'Create Deal Memo'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the terms and rates for this deal memo.'
              : 'Set the rate and terms for this crew member. This will be used to generate their crew rate once signed.'}
          </DialogDescription>
        </DialogHeader>

        {/* Crew Member Info */}
        {displayUser && (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Avatar className="h-10 w-10">
              <AvatarImage src={displayUser.avatar_url || undefined} />
              <AvatarFallback>
                {displayUser.full_name?.charAt(0) || displayUser.username?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">
                {displayUser.full_name || displayUser.username}
              </p>
              {roleTitle && (
                <p className="text-sm text-muted-foreground">{roleTitle}</p>
              )}
            </div>
            {existingMemo?.status && (
              <Badge variant="outline" className="ml-auto">
                {existingMemo.status}
              </Badge>
            )}
          </div>
        )}

        <Separator />

        {/* Form Fields */}
        <div className="space-y-6">
          {/* Template Type */}
          <div>
            <Label>Template Type</Label>
            <Select
              value={formData.template_type}
              onValueChange={(value: 'crew' | 'talent') =>
                setFormData(prev => ({ ...prev, template_type: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="crew">Crew Deal Memo</SelectItem>
                <SelectItem value="talent">Talent Deal Memo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Position & Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="position_title">Position Title *</Label>
              <Input
                id="position_title"
                value={formData.position_title}
                onChange={(e) => setFormData(prev => ({ ...prev, position_title: e.target.value }))}
                placeholder="e.g., Director of Photography"
              />
            </div>

            <div>
              <Label htmlFor="rate_type">Rate Type *</Label>
              <Select
                value={formData.rate_type}
                onValueChange={(value: DealMemoRateType) =>
                  setFormData(prev => ({ ...prev, rate_type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="rate_amount">Rate Amount *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="rate_amount"
                  type="number"
                  step="0.01"
                  min="0"
                  className="pl-9"
                  value={formData.rate_amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, rate_amount: e.target.value }))}
                  placeholder="0.00"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {RATE_TYPE_SUFFIX[formData.rate_type]}
                </span>
              </div>
            </div>
          </div>

          {/* Overtime Multipliers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="overtime_multiplier">Overtime Multiplier</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="overtime_multiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  className="pl-9"
                  value={formData.overtime_multiplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, overtime_multiplier: e.target.value }))}
                  placeholder="1.5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">x</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">OT rate multiplier</p>
            </div>

            <div>
              <Label htmlFor="double_time_multiplier">Double Time Multiplier</Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="double_time_multiplier"
                  type="number"
                  step="0.1"
                  min="1"
                  className="pl-9"
                  value={formData.double_time_multiplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, double_time_multiplier: e.target.value }))}
                  placeholder="2.0"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">x</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">DT rate multiplier</p>
            </div>
          </div>

          {/* Allowances */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Allowances & Rentals</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="kit_rental_rate" className="text-xs text-muted-foreground">Kit Rental</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="kit_rental_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-9"
                    value={formData.kit_rental_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, kit_rental_rate: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="car_allowance" className="text-xs text-muted-foreground">Car Allowance</Label>
                <div className="relative">
                  <Car className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="car_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-9"
                    value={formData.car_allowance}
                    onChange={(e) => setFormData(prev => ({ ...prev, car_allowance: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="phone_allowance" className="text-xs text-muted-foreground">Phone Allowance</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone_allowance"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-9"
                    value={formData.phone_allowance}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone_allowance: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="per_diem_rate" className="text-xs text-muted-foreground">Per Diem</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="per_diem_rate"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-9"
                    value={formData.per_diem_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, per_diem_rate: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="start_date"
                  type="date"
                  className="pl-9"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="end_date">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="end_date"
                  type="date"
                  className="pl-9"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Talent-specific fields */}
          {formData.template_type === 'talent' && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label className="text-sm font-medium block">Talent Details</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="performer_category" className="text-xs text-muted-foreground">Performer Category</Label>
                    <Select
                      value={formData.performer_category}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, performer_category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="principal">Principal</SelectItem>
                        <SelectItem value="supporting">Supporting</SelectItem>
                        <SelectItem value="day_player">Day Player</SelectItem>
                        <SelectItem value="background">Background</SelectItem>
                        <SelectItem value="stunt">Stunt Performer</SelectItem>
                        <SelectItem value="voice_over">Voice Over</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="usage_rights" className="text-xs text-muted-foreground">Usage Rights (JSON)</Label>
                    <Textarea
                      id="usage_rights"
                      value={formData.usage_rights}
                      onChange={(e) => setFormData(prev => ({ ...prev, usage_rights: e.target.value }))}
                      placeholder='{"territories": ["worldwide"], "term": "perpetuity"}'
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Signer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="signer_name">Signer Name</Label>
              <Input
                id="signer_name"
                value={formData.signer_name}
                onChange={(e) => setFormData(prev => ({ ...prev, signer_name: e.target.value }))}
                placeholder="Full name of the signer"
              />
            </div>
            <div>
              <Label htmlFor="signer_email">Signer Email</Label>
              <Input
                id="signer_email"
                type="email"
                value={formData.signer_email}
                onChange={(e) => setFormData(prev => ({ ...prev, signer_email: e.target.value }))}
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional terms or notes..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                {isEditing ? 'Update Deal Memo' : 'Create Deal Memo'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default DealMemoDialog;
