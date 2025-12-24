/**
 * CrewRatesTab - Manage day rates for cast and crew
 */

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  useCrewRates,
  useCrewRateMutations,
  useBookedPeople,
  useProjectRoles,
} from '@/hooks/backlot';
import type {
  CrewRate,
  CrewRateInput,
  CrewRateType,
  BacklotProjectRole,
  BacklotBookedPerson,
} from '@/types/backlot';
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash,
  DollarSign,
  Clock,
  Calendar,
  Loader2,
  Users,
  Car,
  Phone,
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileSignature,
  Upload,
  PenLine,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CrewRatesTabProps {
  projectId: string;
}

const RATE_TYPE_LABELS: Record<CrewRateType, string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  flat: 'Flat Rate',
};

const RATE_TYPE_SUFFIXES: Record<CrewRateType, string> = {
  hourly: '/hr',
  daily: '/day',
  weekly: '/wk',
  flat: '',
};

export function CrewRatesTab({ projectId }: CrewRatesTabProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingRate, setEditingRate] = useState<CrewRate | null>(null);
  const [expandedDepartments, setExpandedDepartments] = useState<Set<string>>(new Set(['Camera', 'Grip & Electric', 'Production']));

  // Queries
  const { data: rates, isLoading } = useCrewRates(projectId);
  const { data: bookedPeople } = useBookedPeople(projectId);
  const { data: projectRoles } = useProjectRoles(projectId, { includeApplications: false });
  const { createRate, updateRate, deleteRate } = useCrewRateMutations(projectId);

  // Group rates by department
  const ratesByDepartment = useMemo(() => {
    if (!rates) return {};

    const grouped: Record<string, CrewRate[]> = {};

    rates.forEach((rate) => {
      const dept = rate.role?.department || 'Other';
      if (!grouped[dept]) {
        grouped[dept] = [];
      }
      grouped[dept].push(rate);
    });

    // Sort departments
    const sortedDepartments = Object.keys(grouped).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    const sorted: Record<string, CrewRate[]> = {};
    sortedDepartments.forEach((dept) => {
      sorted[dept] = grouped[dept].sort((a, b) => {
        const nameA = a.user?.full_name || a.role?.title || '';
        const nameB = b.user?.full_name || b.role?.title || '';
        return nameA.localeCompare(nameB);
      });
    });

    return sorted;
  }, [rates]);

  // Filter rates by search
  const filteredRates = useMemo(() => {
    if (!searchQuery.trim()) return ratesByDepartment;

    const query = searchQuery.toLowerCase();
    const filtered: Record<string, CrewRate[]> = {};

    Object.entries(ratesByDepartment).forEach(([dept, deptRates]) => {
      const matches = deptRates.filter((rate) => {
        const userName = rate.user?.full_name?.toLowerCase() || '';
        const roleTitle = rate.role?.title?.toLowerCase() || '';
        const deptName = dept.toLowerCase();
        return userName.includes(query) || roleTitle.includes(query) || deptName.includes(query);
      });
      if (matches.length > 0) {
        filtered[dept] = matches;
      }
    });

    return filtered;
  }, [ratesByDepartment, searchQuery]);

  const toggleDepartment = (dept: string) => {
    const newExpanded = new Set(expandedDepartments);
    if (newExpanded.has(dept)) {
      newExpanded.delete(dept);
    } else {
      newExpanded.add(dept);
    }
    setExpandedDepartments(newExpanded);
  };

  const handleDelete = async (rateId: string) => {
    if (!confirm('Are you sure you want to delete this rate?')) return;

    try {
      await deleteRate.mutateAsync(rateId);
      toast({
        title: 'Rate deleted',
        description: 'The crew rate has been removed.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete rate',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDateRange = (start: string | null, end: string | null) => {
    if (!start && !end) return 'No dates set';
    if (start && !end) return `From ${format(parseISO(start), 'MMM d, yyyy')}`;
    if (!start && end) return `Until ${format(parseISO(end), 'MMM d, yyyy')}`;
    return `${format(parseISO(start!), 'MMM d')} - ${format(parseISO(end!), 'MMM d, yyyy')}`;
  };

  // Stats
  const totalRates = rates?.length || 0;
  const uniquePeople = new Set(rates?.map(r => r.user_id).filter(Boolean)).size;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Day Rates</h3>
          <p className="text-sm text-muted-foreground">
            Set compensation rates for your cast and crew
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Rate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{totalRates}</p>
                <p className="text-xs text-muted-foreground">Total Rates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{uniquePeople}</p>
                <p className="text-xs text-muted-foreground">People with Rates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">{Object.keys(ratesByDepartment).length}</p>
                <p className="text-xs text-muted-foreground">Departments</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{bookedPeople?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Booked People</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, role, or department..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Rates List by Department */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : Object.keys(filteredRates).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No rates configured</h3>
            <p className="text-muted-foreground mb-4">
              Add day rates for your booked cast and crew members.
            </p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Rate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(filteredRates).map(([department, deptRates]) => (
            <Card key={department}>
              <CardHeader
                className="cursor-pointer hover:bg-muted/50 transition-colors py-3"
                onClick={() => toggleDepartment(department)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expandedDepartments.has(department) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <CardTitle className="text-base">{department}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {deptRates.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              {expandedDepartments.has(department) && (
                <CardContent className="pt-0">
                  <div className="divide-y">
                    {deptRates.map((rate) => (
                      <RateRow
                        key={rate.id}
                        rate={rate}
                        onEdit={() => setEditingRate(rate)}
                        onDelete={() => handleDelete(rate.id)}
                        formatCurrency={formatCurrency}
                        formatDateRange={formatDateRange}
                      />
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Rate Dialog */}
      <RateDialog
        open={showAddDialog || !!editingRate}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingRate(null);
          }
        }}
        rate={editingRate}
        projectId={projectId}
        bookedPeople={bookedPeople || []}
        projectRoles={projectRoles || []}
        onSave={async (input) => {
          try {
            if (editingRate) {
              await updateRate.mutateAsync({ rateId: editingRate.id, input });
              toast({
                title: 'Rate updated',
                description: 'The crew rate has been updated.',
              });
            } else {
              await createRate.mutateAsync(input);
              toast({
                title: 'Rate created',
                description: 'The new crew rate has been added.',
              });
            }
            setShowAddDialog(false);
            setEditingRate(null);
          } catch (error: any) {
            toast({
              title: 'Error',
              description: error.message || 'Failed to save rate',
              variant: 'destructive',
            });
          }
        }}
        isLoading={createRate.isPending || updateRate.isPending}
      />
    </div>
  );
}

// Rate Row Component
interface RateRowProps {
  rate: CrewRate;
  onEdit: () => void;
  onDelete: () => void;
  formatCurrency: (amount: number) => string;
  formatDateRange: (start: string | null, end: string | null) => string;
}

function RateRow({ rate, onEdit, onDelete, formatCurrency, formatDateRange }: RateRowProps) {
  return (
    <div className="flex items-center justify-between py-3 group">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={rate.user?.avatar_url || undefined} />
          <AvatarFallback>
            {rate.user?.full_name?.charAt(0) || rate.role?.title?.charAt(0) || '?'}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {rate.user?.full_name || 'Unassigned'}
            </p>
            {/* Source indicator */}
            {rate.source === 'deal_memo' && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                <FileSignature className="w-3 h-3" />
                Deal Memo
              </Badge>
            )}
            {rate.source === 'imported' && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <Upload className="w-3 h-3" />
                Imported
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {rate.role?.title || 'No role specified'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Rate Info */}
        <div className="text-right">
          <p className="font-semibold text-green-600">
            {formatCurrency(rate.rate_amount)}
            <span className="text-muted-foreground font-normal">
              {RATE_TYPE_SUFFIXES[rate.rate_type]}
            </span>
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {rate.rate_type !== 'flat' && (
              <>
                <span>OT {rate.overtime_multiplier}x</span>
                <span>|</span>
                <span>DT {rate.double_time_multiplier}x</span>
              </>
            )}
          </div>
        </div>

        {/* Allowances */}
        <div className="flex items-center gap-2 min-w-[140px]">
          {rate.kit_rental_rate && (
            <Badge variant="outline" className="text-xs">
              <Briefcase className="w-3 h-3 mr-1" />
              Kit {formatCurrency(rate.kit_rental_rate)}
            </Badge>
          )}
          {rate.car_allowance && (
            <Badge variant="outline" className="text-xs">
              <Car className="w-3 h-3 mr-1" />
              {formatCurrency(rate.car_allowance)}
            </Badge>
          )}
          {rate.phone_allowance && (
            <Badge variant="outline" className="text-xs">
              <Phone className="w-3 h-3 mr-1" />
              {formatCurrency(rate.phone_allowance)}
            </Badge>
          )}
        </div>

        {/* Effective Dates */}
        <div className="text-xs text-muted-foreground min-w-[150px] text-right">
          <Calendar className="w-3 h-3 inline mr-1" />
          {formatDateRange(rate.effective_start, rate.effective_end)}
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Rate
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// Rate Dialog Component
interface RateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rate: CrewRate | null;
  projectId: string;
  bookedPeople: BacklotBookedPerson[];
  projectRoles: BacklotProjectRole[];
  onSave: (input: CrewRateInput) => Promise<void>;
  isLoading: boolean;
}

function RateDialog({
  open,
  onOpenChange,
  rate,
  projectId,
  bookedPeople,
  projectRoles,
  onSave,
  isLoading,
}: RateDialogProps) {
  const [userId, setUserId] = useState<string | null>(rate?.user_id || null);
  const [roleId, setRoleId] = useState<string | null>(rate?.role_id || null);
  const [rateType, setRateType] = useState<CrewRateType>(rate?.rate_type || 'daily');
  const [rateAmount, setRateAmount] = useState(rate?.rate_amount?.toString() || '');
  const [overtimeMultiplier, setOvertimeMultiplier] = useState(rate?.overtime_multiplier?.toString() || '1.5');
  const [doubleTimeMultiplier, setDoubleTimeMultiplier] = useState(rate?.double_time_multiplier?.toString() || '2.0');
  const [kitRentalRate, setKitRentalRate] = useState(rate?.kit_rental_rate?.toString() || '');
  const [carAllowance, setCarAllowance] = useState(rate?.car_allowance?.toString() || '');
  const [phoneAllowance, setPhoneAllowance] = useState(rate?.phone_allowance?.toString() || '');
  const [effectiveStart, setEffectiveStart] = useState(rate?.effective_start || '');
  const [effectiveEnd, setEffectiveEnd] = useState(rate?.effective_end || '');
  const [notes, setNotes] = useState(rate?.notes || '');

  // Reset form when rate changes
  useState(() => {
    if (rate) {
      setUserId(rate.user_id);
      setRoleId(rate.role_id);
      setRateType(rate.rate_type);
      setRateAmount(rate.rate_amount?.toString() || '');
      setOvertimeMultiplier(rate.overtime_multiplier?.toString() || '1.5');
      setDoubleTimeMultiplier(rate.double_time_multiplier?.toString() || '2.0');
      setKitRentalRate(rate.kit_rental_rate?.toString() || '');
      setCarAllowance(rate.car_allowance?.toString() || '');
      setPhoneAllowance(rate.phone_allowance?.toString() || '');
      setEffectiveStart(rate.effective_start || '');
      setEffectiveEnd(rate.effective_end || '');
      setNotes(rate.notes || '');
    } else {
      setUserId(null);
      setRoleId(null);
      setRateType('daily');
      setRateAmount('');
      setOvertimeMultiplier('1.5');
      setDoubleTimeMultiplier('2.0');
      setKitRentalRate('');
      setCarAllowance('');
      setPhoneAllowance('');
      setEffectiveStart('');
      setEffectiveEnd('');
      setNotes('');
    }
  });

  const handleSubmit = async () => {
    const input: CrewRateInput = {
      user_id: userId,
      role_id: roleId,
      rate_type: rateType,
      rate_amount: parseFloat(rateAmount) || 0,
      overtime_multiplier: parseFloat(overtimeMultiplier) || 1.5,
      double_time_multiplier: parseFloat(doubleTimeMultiplier) || 2.0,
      kit_rental_rate: kitRentalRate ? parseFloat(kitRentalRate) : null,
      car_allowance: carAllowance ? parseFloat(carAllowance) : null,
      phone_allowance: phoneAllowance ? parseFloat(phoneAllowance) : null,
      effective_start: effectiveStart || null,
      effective_end: effectiveEnd || null,
      notes: notes || null,
    };

    await onSave(input);
  };

  // Get unique crew roles (non-cast)
  const crewRoles = projectRoles?.filter(r => r.type === 'crew' && r.status === 'booked') || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rate ? 'Edit Rate' : 'Add Crew Rate'}</DialogTitle>
          <DialogDescription>
            Set the day rate and compensation for a crew member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Crew Member Selection */}
          <div className="space-y-2">
            <Label>Crew Member</Label>
            <Select
              value={userId || ''}
              onValueChange={(v) => {
                setUserId(v || null);
                // Try to auto-set role based on booked person
                const person = bookedPeople?.find(p => p.user_id === v);
                if (person?.role_id) {
                  setRoleId(person.role_id);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select crew member" />
              </SelectTrigger>
              <SelectContent>
                {bookedPeople?.map((person) => (
                  <SelectItem key={person.user_id} value={person.user_id}>
                    {person.name} - {person.role_title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Role Selection (optional, for role-based rates) */}
          <div className="space-y-2">
            <Label>Role (optional)</Label>
            <Select
              value={roleId || ''}
              onValueChange={(v) => setRoleId(v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific role</SelectItem>
                {crewRoles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.title} ({role.department || 'No dept'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set role for department grouping or role-based default rates
            </p>
          </div>

          {/* Rate Type & Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rate Type</Label>
              <Select
                value={rateType}
                onValueChange={(v) => setRateType(v as CrewRateType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="flat">Flat Rate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate Amount ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={rateAmount}
                onChange={(e) => setRateAmount(e.target.value)}
              />
            </div>
          </div>

          {/* OT/DT Multipliers */}
          {rateType !== 'flat' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Overtime Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="1.5"
                  value={overtimeMultiplier}
                  onChange={(e) => setOvertimeMultiplier(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Double Time Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="2.0"
                  value={doubleTimeMultiplier}
                  onChange={(e) => setDoubleTimeMultiplier(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Allowances */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Kit Rental ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={kitRentalRate}
                onChange={(e) => setKitRentalRate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Car Allowance ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={carAllowance}
                onChange={(e) => setCarAllowance(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone ($)</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={phoneAllowance}
                onChange={(e) => setPhoneAllowance(e.target.value)}
              />
            </div>
          </div>

          {/* Effective Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Effective Start</Label>
              <Input
                type="date"
                value={effectiveStart}
                onChange={(e) => setEffectiveStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Effective End</Label>
              <Input
                type="date"
                value={effectiveEnd}
                onChange={(e) => setEffectiveEnd(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any special terms or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !rateAmount}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {rate ? 'Update Rate' : 'Add Rate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
