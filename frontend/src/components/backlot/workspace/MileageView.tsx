/**
 * MileageView - Mileage tracking and reimbursement management
 * Crew can log mileage, managers can approve/reject
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Car,
  Plus,
  Check,
  X,
  MapPin,
  DollarSign,
  Loader2,
  Edit3,
  Trash2,
  RefreshCw,
  Send,
  Navigation,
  Search,
} from 'lucide-react';
import {
  useMileageEntries,
  useCreateMileage,
  useUpdateMileage,
  useDeleteMileage,
  useApproveMileage,
  useRejectMileage,
  useMarkMileageReimbursed,
  useSubmitMileageForApproval,
  useBulkSubmitMileageForApproval,
  useExpenseSettings,
  useSearchPlaces,
  useCalculateRoute,
  useBudget,
  MileageEntry,
  CreateMileageData,
  PlaceSuggestion,
  MILEAGE_PURPOSE_OPTIONS,
  EXPENSE_STATUS_CONFIG,
  formatCurrency,
  calculateMileageTotal,
} from '@/hooks/backlot';
import { cn } from '@/lib/utils';
import { saveDraft, loadDraft, clearDraft as clearDraftStorage, buildDraftKey } from '@/lib/formDraftStorage';

interface MileageViewProps {
  projectId: string;
  canEdit: boolean;
}

function MileageView({ projectId, canEdit }: MileageViewProps) {
  // For expense approval, canEdit implies approval permissions for now
  const canApprove = canEdit;
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<MileageEntry | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: entries = [], isLoading, refetch } = useMileageEntries(
    projectId,
    statusFilter !== 'all' ? { status: statusFilter } : undefined
  );
  const { data: settings } = useExpenseSettings(projectId);
  const createMileage = useCreateMileage(projectId);
  const updateMileage = useUpdateMileage(projectId);
  const deleteMileage = useDeleteMileage(projectId);
  const approveMileage = useApproveMileage(projectId);
  const rejectMileage = useRejectMileage(projectId);
  const markReimbursed = useMarkMileageReimbursed(projectId);
  const submitForApproval = useSubmitMileageForApproval(projectId);
  const bulkSubmitForApproval = useBulkSubmitMileageForApproval(projectId);

  // Calculate totals including drafts
  const draftEntries = entries.filter(e => e.status === 'draft');
  const totalDraft = draftEntries.reduce((sum, e) => sum + (e.total_amount || 0), 0);
  const totalPending = entries
    .filter(e => e.status === 'pending')
    .reduce((sum, e) => sum + (e.total_amount || 0), 0);
  const totalApproved = entries
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + (e.total_amount || 0), 0);

  const handleSubmitForApproval = async (id: string) => {
    try {
      await submitForApproval.mutateAsync(id);
    } catch (error) {
      console.error('Failed to submit for approval:', error);
    }
  };

  const handleBulkSubmitForApproval = async () => {
    if (draftEntries.length === 0) return;
    try {
      const entryIds = draftEntries.map(e => e.id);
      await bulkSubmitForApproval.mutateAsync(entryIds);
    } catch (error) {
      console.error('Failed to bulk submit:', error);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveMileage.mutateAsync({ mileageId: id });
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    try {
      await rejectMileage.mutateAsync({ mileageId: showRejectModal, reason: rejectReason });
      setShowRejectModal(null);
      setRejectReason('');
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mileage entry?')) return;
    try {
      await deleteMileage.mutateAsync(id);
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleMarkReimbursed = async (id: string) => {
    try {
      await markReimbursed.mutateAsync({ mileageId: id });
    } catch (error) {
      console.error('Failed to mark as reimbursed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Car className="w-5 h-5" />
            Mileage
          </h2>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="reimbursed">Reimbursed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Mileage
        </Button>
      </div>

      {/* Ready for Approval Card */}
      {draftEntries.length > 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {draftEntries.length} mileage {draftEntries.length === 1 ? 'entry' : 'entries'} ready for approval
                </p>
                <p className="text-lg font-semibold">{formatCurrency(totalDraft)}</p>
              </div>
              <Button
                onClick={handleBulkSubmitForApproval}
                disabled={bulkSubmitForApproval.isPending}
                className="bg-amber-500 hover:bg-amber-600 text-black"
              >
                {bulkSubmitForApproval.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send All for Approval
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{entries.length}</div>
            <div className="text-sm text-muted-foreground">Total Entries</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-gray-400">
              {formatCurrency(totalDraft)}
            </div>
            <div className="text-sm text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-500">
              {formatCurrency(totalPending)}
            </div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-charcoal-black border-muted-gray/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(totalApproved)}
            </div>
            <div className="text-sm text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {entries.length === 0 ? (
          <Card className="bg-charcoal-black border-muted-gray/20">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Car className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No mileage entries found</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Mileage
              </Button>
            </CardContent>
          </Card>
        ) : (
          entries.map(entry => (
            <MileageEntryCard
              key={entry.id}
              entry={entry}
              canApprove={canApprove}
              onApprove={() => handleApprove(entry.id)}
              onReject={() => setShowRejectModal(entry.id)}
              onEdit={() => setEditingEntry(entry)}
              onDelete={() => handleDelete(entry.id)}
              onMarkReimbursed={() => handleMarkReimbursed(entry.id)}
              onSubmitForApproval={() => handleSubmitForApproval(entry.id)}
            />
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      <MileageFormModal
        projectId={projectId}
        isOpen={showAddModal || !!editingEntry}
        onClose={() => {
          setShowAddModal(false);
          setEditingEntry(null);
        }}
        entry={editingEntry}
        defaultRate={settings?.mileage_rate ?? 0.67}
        requireLocations={settings?.require_mileage_locations ?? false}
      />

      {/* Reject Modal */}
      <Dialog open={!!showRejectModal} onOpenChange={() => setShowRejectModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Mileage Entry</DialogTitle>
            <DialogDescription>
              Provide a reason for rejection (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectModal(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMileage.isPending}
            >
              {rejectMileage.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MileageEntryCardProps {
  entry: MileageEntry;
  canApprove: boolean;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkReimbursed: () => void;
  onSubmitForApproval: () => void;
}

function MileageEntryCard({
  entry,
  canApprove,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  onMarkReimbursed,
  onSubmitForApproval,
}: MileageEntryCardProps) {
  const statusConfig = EXPENSE_STATUS_CONFIG[entry.status as keyof typeof EXPENSE_STATUS_CONFIG];
  const purposeLabel = MILEAGE_PURPOSE_OPTIONS.find(p => p.value === entry.purpose)?.label || entry.purpose;

  return (
    <Card className="bg-charcoal-black border-muted-gray/20 hover:border-muted-gray/40 transition-colors">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="font-medium">
                {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <Badge className={cn('text-xs', statusConfig?.color)}>
                {statusConfig?.label || entry.status}
              </Badge>
              {entry.is_round_trip && (
                <Badge variant="outline" className="text-xs">
                  Round Trip
                </Badge>
              )}
              {purposeLabel && (
                <Badge variant="secondary" className="text-xs">
                  {purposeLabel}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <MapPin className="w-4 h-4" />
              <span>
                {entry.start_location || 'Start'} → {entry.end_location || 'End'}
              </span>
            </div>

            {entry.description && (
              <p className="text-sm text-muted-foreground mb-2">{entry.description}</p>
            )}

            {entry.user_name && (
              <p className="text-xs text-muted-foreground">By: {entry.user_name}</p>
            )}

            {entry.rejection_reason && (
              <p className="text-sm text-red-500 mt-2">
                Rejected: {entry.rejection_reason}
              </p>
            )}
          </div>

          <div className="text-right space-y-2">
            <div className="text-lg font-bold">{formatCurrency(entry.total_amount)}</div>
            <div className="text-sm text-muted-foreground">
              {entry.is_round_trip ? entry.miles * 2 : entry.miles} mi @ ${entry.rate_per_mile}/mi
            </div>

            <div className="flex items-center gap-2 justify-end mt-3">
              {entry.status === 'draft' && (
                <>
                  <Button variant="ghost" size="icon" onClick={onEdit}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onDelete}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSubmitForApproval}
                    className="text-amber-500 border-amber-500/50 hover:bg-amber-500/10"
                  >
                    <Send className="w-4 h-4 mr-1" />
                    Submit
                  </Button>
                </>
              )}
              {entry.status === 'pending' && (
                <>
                  <Button variant="ghost" size="icon" onClick={onEdit}>
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={onDelete}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {canApprove && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-green-500 hover:text-green-600"
                        onClick={onApprove}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:text-red-600"
                        onClick={onReject}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </>
              )}
              {entry.status === 'approved' && canApprove && (
                <Button variant="outline" size="sm" onClick={onMarkReimbursed}>
                  <DollarSign className="w-4 h-4 mr-1" />
                  Mark Paid
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AddressInputProps {
  projectId: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  placeholder?: string;
  label: string;
  id: string;
  required?: boolean;
}

function AddressInput({
  projectId,
  value,
  onChange,
  onSelect,
  placeholder,
  label,
  id,
  required,
}: AddressInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { searchPlaces } = useSearchPlaces(projectId);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Debounced search
  React.useEffect(() => {
    if (value.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const results = await searchPlaces(value);
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, searchPlaces]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (place: PlaceSuggestion) => {
    onChange(place.label);
    onSelect(place);
    setIsOpen(false);
  };

  return (
    <div className="space-y-2 relative">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-8"
          required={required}
          autoComplete="off"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {isOpen && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-charcoal-black border border-muted-gray/30 rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((place, idx) => (
            <button
              key={place.place_id || idx}
              type="button"
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted-gray/20 flex items-start gap-2"
              onClick={() => handleSelect(place)}
            >
              <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="line-clamp-2">{place.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface MileageFormModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  entry?: MileageEntry | null;
  defaultRate: number;
  requireLocations?: boolean;
}

function MileageFormModal({
  projectId,
  isOpen,
  onClose,
  entry,
  defaultRate,
  requireLocations = false,
}: MileageFormModalProps) {
  const [formData, setFormData] = useState<CreateMileageData>({
    date: entry?.date || new Date().toISOString().split('T')[0],
    description: entry?.description || '',
    start_location: entry?.start_location || '',
    end_location: entry?.end_location || '',
    miles: entry?.miles || 0,
    rate_per_mile: entry?.rate_per_mile || defaultRate,
    is_round_trip: entry?.is_round_trip || false,
    purpose: entry?.purpose || '',
    notes: entry?.notes || '',
    budget_category_id: (entry as any)?.budget_category_id || null,
    budget_line_item_id: (entry as any)?.budget_line_item_id || null,
  });

  const [startPlace, setStartPlace] = useState<PlaceSuggestion | null>(null);
  const [endPlace, setEndPlace] = useState<PlaceSuggestion | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);

  const { data: budget } = useBudget(projectId);
  const budgetId = budget?.id || null;
  const createMileage = useCreateMileage(projectId);
  const updateMileage = useUpdateMileage(projectId);
  const calculateRoute = useCalculateRoute(projectId);

  const isEditing = !!entry;
  const isPending = createMileage.isPending || updateMileage.isPending;

  // --- Draft persistence (create mode only) ---
  const draftKey = buildDraftKey('backlot', 'mileage', 'new');

  // Restore draft when opening create form
  React.useEffect(() => {
    if (isOpen && !entry) {
      const saved = loadDraft<CreateMileageData>(draftKey);
      if (saved) {
        setFormData(prev => ({ ...prev, ...saved.data }));
      }
    }
  }, [isOpen, entry]);

  // Auto-save draft (debounced, create mode only)
  React.useEffect(() => {
    if (!isOpen || isEditing) return;
    const timer = setTimeout(() => {
      saveDraft(draftKey, formData);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData, isOpen, isEditing]);

  // Auto-calculate distance when both addresses are selected
  React.useEffect(() => {
    if (startPlace && endPlace && formData.start_location && formData.end_location) {
      setIsCalculating(true);
      calculateRoute.mutateAsync({
        startAddress: formData.start_location,
        endAddress: formData.end_location,
      }).then(result => {
        if (result.distance_miles) {
          setFormData(prev => ({
            ...prev,
            miles: Math.round(result.distance_miles * 10) / 10, // Round to 1 decimal
          }));
        }
      }).catch(err => {
        console.error('Route calculation failed:', err);
      }).finally(() => {
        setIsCalculating(false);
      });
    }
  }, [startPlace, endPlace]);

  // Update form when entry changes
  React.useEffect(() => {
    if (entry) {
      setFormData({
        date: entry.date,
        description: entry.description || '',
        start_location: entry.start_location || '',
        end_location: entry.end_location || '',
        miles: entry.miles,
        rate_per_mile: entry.rate_per_mile,
        is_round_trip: entry.is_round_trip,
        purpose: entry.purpose || '',
        notes: entry.notes || '',
        budget_category_id: (entry as any)?.budget_category_id || null,
        budget_line_item_id: (entry as any)?.budget_line_item_id || null,
        scene_id: entry.scene_id || null,
      });
      setStartPlace(null);
      setEndPlace(null);
    } else {
      setFormData({
        date: new Date().toISOString().split('T')[0],
        description: '',
        start_location: '',
        end_location: '',
        miles: 0,
        rate_per_mile: defaultRate,
        is_round_trip: false,
        purpose: '',
        notes: '',
        budget_category_id: null,
        budget_line_item_id: null,
        scene_id: null,
      });
      setStartPlace(null);
      setEndPlace(null);
    }
  }, [entry, defaultRate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && entry) {
        await updateMileage.mutateAsync({
          mileageId: entry.id,
          data: formData,
        });
      } else {
        await createMileage.mutateAsync(formData);
        clearDraftStorage(draftKey);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const calculatedTotal = calculateMileageTotal(
    formData.miles || 0,
    formData.rate_per_mile || defaultRate,
    formData.is_round_trip || false
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Mileage' : 'Log Mileage'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={e => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <AddressInput
            projectId={projectId}
            id="start_address"
            label="Start Address"
            value={formData.start_location || ''}
            onChange={value => setFormData({ ...formData, start_location: value })}
            onSelect={place => setStartPlace(place)}
            placeholder="Search for start address..."
            required={requireLocations}
          />

          <AddressInput
            projectId={projectId}
            id="end_address"
            label="End Address"
            value={formData.end_location || ''}
            onChange={value => setFormData({ ...formData, end_location: value })}
            onSelect={place => setEndPlace(place)}
            placeholder="Search for end address..."
            required={requireLocations}
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="miles">Miles</Label>
              {isCalculating && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Calculating...
                </span>
              )}
            </div>
            <Input
              id="miles"
              type="number"
              step="0.1"
              min="0"
              value={formData.miles || ''}
              onChange={e => setFormData({ ...formData, miles: parseFloat(e.target.value) || 0 })}
              required
            />
            {startPlace && endPlace && formData.miles > 0 && (
              <p className="text-xs text-muted-foreground">
                Distance auto-calculated from addresses
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="round_trip"
              checked={formData.is_round_trip}
              onCheckedChange={checked =>
                setFormData({ ...formData, is_round_trip: checked === true })
              }
            />
            <Label htmlFor="round_trip" className="text-sm font-normal">
              Round trip (doubles miles)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Select
              value={formData.purpose || ''}
              onValueChange={value => setFormData({ ...formData, purpose: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select purpose..." />
              </SelectTrigger>
              <SelectContent>
                {MILEAGE_PURPOSE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {formData.is_round_trip ? (formData.miles || 0) * 2 : formData.miles || 0} miles
                  @ ${formData.rate_per_mile || defaultRate}/mi
                </span>
                <span className="text-lg font-bold">{formatCurrency(calculatedTotal)}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !formData.miles}>
              {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Submit'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MileageView;
