/**
 * ClearancesView - Manage project clearances, releases, and contracts
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileCheck,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Calendar,
  Mail,
  Phone,
  Download,
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  User,
  MapPin,
  Music,
  FileText,
  ExternalLink,
  UserPlus,
  Send,
  Package,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useClearances,
  useClearanceSummary,
  useClearanceTemplates,
  useProjectLocations,
  useClearanceDocumentUpload,
  useBulkUpdateClearances,
} from '@/hooks/backlot';
import {
  ClearanceDocumentUpload,
  ClearanceHistoryTimeline,
  EOChecklistView,
  ExpiringClearancesAlert,
  ClearanceDetailView,
  PendingDocumentUpload,
  RecipientPicker,
  PendingRecipientsList,
  ClearanceSendModal,
  type PendingRecipient,
} from './clearances';
import { DocumentPackagesView } from './packages/DocumentPackagesView';
import {
  BacklotClearanceItem,
  BacklotClearanceType,
  BacklotClearanceStatus,
  ClearanceItemInput,
  ClearancePriority,
  ClearanceRecipientInput,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
  CLEARANCE_STATUS_LABELS,
  CLEARANCE_STATUS_COLORS,
  CLEARANCE_TYPE_GROUPS,
  CLEARANCE_TYPE_GROUP_LABELS,
  CLEARANCE_PRIORITY_LABELS,
  CLEARANCE_PRIORITY_COLORS,
} from '@/types/backlot';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ClearancesViewProps {
  projectId: string;
  canEdit: boolean;
  personFilter?: string | null; // Filter to show only clearances for this person
  personFilterName?: string; // Display name for the person filter chip
  onClearPersonFilter?: () => void; // Callback to clear the person filter
  // Pre-fill data for Add form (when navigating from Casting tab)
  prefillPersonId?: string | null;
  prefillPersonName?: string | null;
}

const STATUS_ICONS: Record<BacklotClearanceStatus | 'missing', React.ElementType> = {
  not_started: Clock,
  requested: Clock,
  pending: Clock,
  signed: CheckCircle,
  expired: AlertTriangle,
  rejected: XCircle,
  missing: AlertTriangle,
};

const STATUS_CONFIG: Record<BacklotClearanceStatus, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'bg-gray-500/20 text-gray-500 border-gray-500/30' },
  requested: { label: 'Requested', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  pending: { label: 'Pending', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  signed: { label: 'Signed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  expired: { label: 'Expired', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const TYPE_ICONS: Record<string, React.ElementType> = {
  talent_release: User,
  location_release: MapPin,
  appearance_release: User,
  nda: FileText,
  music_license: Music,
  stock_license: FileText,
  other_contract: FileText,
};

// Clearance Card Component
const ClearanceCard: React.FC<{
  item: BacklotClearanceItem;
  canEdit: boolean;
  onEdit: (item: BacklotClearanceItem) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: BacklotClearanceStatus) => void;
  onClick: (item: BacklotClearanceItem) => void;
}> = ({ item, canEdit, onEdit, onDelete, onStatusChange, onClick }) => {
  const statusConfig = STATUS_CONFIG[item.status];
  const TypeIcon = TYPE_ICONS[item.type] || FileText;
  const StatusIcon = STATUS_ICONS[item.status];

  const isExpiringSoon = useMemo(() => {
    if (!item.expiration_date || item.status !== 'signed') return false;
    const expDate = new Date(item.expiration_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expDate <= thirtyDaysFromNow;
  }, [item.expiration_date, item.status]);

  return (
    <div
      className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-primary-red/50 transition-colors cursor-pointer"
      onClick={() => onClick(item)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Title & Type */}
          <div className="flex items-center gap-2 mb-1">
            <TypeIcon className="w-4 h-4 text-accent-yellow shrink-0" />
            <h4 className="font-medium text-bone-white truncate">{item.title}</h4>
          </div>

          {/* Type & Status Badges */}
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge variant="outline" className={cn('text-xs', `border-${CLEARANCE_TYPE_COLORS[item.type]}-500/30 text-${CLEARANCE_TYPE_COLORS[item.type]}-400`)}>
              {CLEARANCE_TYPE_LABELS[item.type]}
            </Badge>
            <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig.label}
            </Badge>
            {/* Document Status Badge */}
            {item.file_url ? (
              <Badge className="text-xs bg-green-500/10 text-green-400 border border-green-500/30">
                <FileCheck className="w-3 h-3 mr-1" />
                Doc
              </Badge>
            ) : (
              <Badge className="text-xs bg-gray-500/10 text-gray-500 border border-gray-500/30">
                <FileText className="w-3 h-3 mr-1" />
                No Doc
              </Badge>
            )}
            {isExpiringSoon && (
              <Badge variant="outline" className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Expiring Soon
              </Badge>
            )}
          </div>

          {/* Related Entity */}
          {(item.related_person_name || item.related_location?.name || item.related_asset_label) && (
            <p className="text-sm text-muted-gray mb-2">
              {item.related_person_name ||
                item.related_location?.name ||
                item.related_asset_label}
            </p>
          )}

          {/* Dates */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-gray">
            {item.signed_date && (
              <span className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-400" />
                Signed {format(new Date(item.signed_date), 'MMM d, yyyy')}
              </span>
            )}
            {item.expiration_date && (
              <span className={cn('flex items-center gap-1', isExpiringSoon && 'text-orange-400')}>
                <Calendar className="w-3 h-3" />
                Expires {format(new Date(item.expiration_date), 'MMM d, yyyy')}
              </span>
            )}
            {item.contact_email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {item.contact_email}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {item.file_url && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => window.open(item.file_url!, '_blank')}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          )}
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(item)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                {item.status !== 'signed' && (
                  <DropdownMenuItem onClick={() => onStatusChange(item.id, 'signed')}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Mark as Signed
                  </DropdownMenuItem>
                )}
                {item.status === 'not_started' && (
                  <DropdownMenuItem onClick={() => onStatusChange(item.id, 'requested')}>
                    <Clock className="w-4 h-4 mr-2" />
                    Mark as Requested
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-red-400" onClick={() => onDelete(item.id)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
};

// Summary Stats Component
const ClearanceStats: React.FC<{ projectId: string }> = ({ projectId }) => {
  const { data: summary, isLoading } = useClearanceSummary(projectId);

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: 'Total', value: summary.total, color: 'text-bone-white' },
    { label: 'Signed', value: summary.by_status.signed || 0, color: 'text-green-400' },
    { label: 'Requested', value: summary.by_status.requested || 0, color: 'text-yellow-400' },
    { label: 'Not Started', value: summary.by_status.not_started || 0, color: 'text-gray-500' },
    { label: 'Expiring Soon', value: summary.expiring_soon, color: 'text-orange-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label} className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted-gray">{stat.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const ClearancesView: React.FC<ClearancesViewProps> = ({
  projectId,
  canEdit,
  personFilter,
  personFilterName,
  onClearPersonFilter,
  prefillPersonId,
  prefillPersonName,
}) => {
  const [activeTab, setActiveTab] = useState<keyof typeof CLEARANCE_TYPE_GROUPS | 'all' | 'eo' | 'expiring' | 'packages'>('all');
  const [statusFilter, setStatusFilter] = useState<BacklotClearanceStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClearances, setSelectedClearances] = useState<Set<string>>(new Set());
  const [selectedClearanceId, setSelectedClearanceId] = useState<string | null>(null);

  const { clearances, isLoading, createClearance, updateClearance, updateStatus, deleteClearance } = useClearances({
    projectId,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: searchQuery || undefined,
  });

  const { data: locations } = useProjectLocations(projectId);
  const { data: templates } = useClearanceTemplates();

  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<BacklotClearanceItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Recipients state (for new clearances)
  const [pendingRecipients, setPendingRecipients] = useState<PendingRecipient[]>([]);
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);

  // Send after save state
  const [sendAfterSave, setSendAfterSave] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [newClearanceForSend, setNewClearanceForSend] = useState<BacklotClearanceItem | null>(null);

  const uploadMutation = useClearanceDocumentUpload();

  // Form state
  const [formData, setFormData] = useState<ClearanceItemInput>({
    type: 'talent_release',
    title: '',
    description: '',
    related_person_name: '',
    related_location_id: '',
    related_asset_label: '',
    status: 'not_started',
    requested_date: '',
    signed_date: '',
    expiration_date: '',
    contact_email: '',
    contact_phone: '',
    notes: '',
    file_is_sensitive: false,
  });

  // Filter clearances by active tab and person filter
  const filteredClearances = useMemo(() => {
    let filtered = clearances;

    // Apply person filter if set
    if (personFilter) {
      filtered = filtered.filter((c) => c.related_person_id === personFilter);
    }

    // Apply tab filter
    if (activeTab !== 'all' && activeTab !== 'eo' && activeTab !== 'expiring') {
      const typeGroup = CLEARANCE_TYPE_GROUPS[activeTab as keyof typeof CLEARANCE_TYPE_GROUPS];
      if (typeGroup) {
        filtered = filtered.filter((c) => typeGroup.includes(c.type));
      }
    }

    return filtered;
  }, [clearances, activeTab, personFilter]);

  // Group clearances by type for matrix view
  const clearancesByType = useMemo(() => {
    const groups: Record<BacklotClearanceType, BacklotClearanceItem[]> = {
      talent_release: [],
      location_release: [],
      appearance_release: [],
      nda: [],
      music_license: [],
      stock_license: [],
      other_contract: [],
    };
    filteredClearances.forEach((c) => {
      groups[c.type].push(c);
    });
    return groups;
  }, [filteredClearances]);

  // Track if we've already auto-opened for this prefill
  const prefillHandledRef = useRef<string | null>(null);

  // Auto-open form when navigating from Casting with pre-fill data
  useEffect(() => {
    if (
      prefillPersonId &&
      prefillPersonName &&
      canEdit &&
      !showForm &&
      prefillHandledRef.current !== prefillPersonId
    ) {
      prefillHandledRef.current = prefillPersonId;
      // Small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        handleOpenForm();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [prefillPersonId, prefillPersonName, canEdit]);

  const resetForm = () => {
    setFormData({
      type: 'talent_release',
      title: '',
      description: '',
      related_person_name: '',
      related_location_id: '',
      related_asset_label: '',
      status: 'not_started',
      requested_date: '',
      signed_date: '',
      expiration_date: '',
      contact_email: '',
      contact_phone: '',
      notes: '',
      file_is_sensitive: false,
    });
  };

  const handleOpenForm = (item?: BacklotClearanceItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        type: item.type,
        title: item.title,
        description: item.description || '',
        related_person_name: item.related_person_name || '',
        related_location_id: item.related_location_id || '',
        related_asset_label: item.related_asset_label || '',
        status: item.status,
        requested_date: item.requested_date || '',
        signed_date: item.signed_date || '',
        expiration_date: item.expiration_date || '',
        contact_email: item.contact_email || '',
        contact_phone: item.contact_phone || '',
        notes: item.notes || '',
        file_is_sensitive: item.file_is_sensitive,
      });
    } else {
      setEditingItem(null);
      // Check for pre-fill data from Casting navigation
      if (prefillPersonId && prefillPersonName) {
        setFormData({
          type: 'talent_release',
          title: `${prefillPersonName} - Talent Release`,
          description: '',
          related_person_name: prefillPersonName,
          related_person_id: prefillPersonId,
          related_location_id: '',
          related_asset_label: '',
          status: 'not_started',
          requested_date: '',
          signed_date: '',
          expiration_date: '',
          contact_email: '',
          contact_phone: '',
          notes: '',
          file_is_sensitive: false,
        });
      } else {
        resetForm();
      }
    }
    setPendingFile(null);
    setPendingRecipients([]);
    setSendAfterSave(false);
    setShowForm(true);
  };

  // Helper to add recipient to a clearance
  const addRecipientToClearance = async (clearanceId: string, input: ClearanceRecipientInput) => {
    const token = api.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_API_URL || ''}/api/v1/backlot/clearances/${clearanceId}/recipients`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add recipient' }));
      throw new Error(error.detail);
    }

    return response.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingItem) {
        await updateClearance.mutateAsync({
          id: editingItem.id,
          ...formData,
        });
      } else {
        // Create clearance first
        const newClearance = await createClearance.mutateAsync({
          projectId,
          ...formData,
        });

        // If there's a pending file, upload it after creation
        if (pendingFile && newClearance?.id) {
          try {
            await uploadMutation.mutateAsync({
              clearanceId: newClearance.id,
              file: pendingFile,
            });
          } catch (uploadErr) {
            console.error('Failed to upload document:', uploadErr);
            // Don't fail the whole operation, clearance was created
          }
        }

        // Add pending recipients
        if (pendingRecipients.length > 0 && newClearance?.id) {
          for (const recipient of pendingRecipients) {
            try {
              const input: ClearanceRecipientInput = {
                requires_signature: recipient.requires_signature,
              };
              if (recipient.project_contact_id) {
                input.project_contact_id = recipient.project_contact_id;
              }
              if (recipient.project_member_user_id) {
                input.project_member_user_id = recipient.project_member_user_id;
              }
              if (recipient.manual_email) {
                input.manual_email = recipient.manual_email;
                input.manual_name = recipient.manual_name;
              }

              await addRecipientToClearance(newClearance.id, input);
            } catch (recipientErr) {
              console.error('Failed to add recipient:', recipientErr);
              // Continue with other recipients
            }
          }
        }

        // Handle send after save
        if (sendAfterSave && newClearance?.id && pendingFile && pendingRecipients.length > 0) {
          // Set up for send modal to open after form closes
          setNewClearanceForSend(newClearance);
          setShowSendModal(true);
        }
      }
      setShowForm(false);
      resetForm();
      setPendingFile(null);
      setPendingRecipients([]);
      setSendAfterSave(false);
    } catch (err) {
      console.error('Failed to save clearance:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this clearance item?')) {
      await deleteClearance.mutateAsync(id);
    }
  };

  const handleStatusChange = async (id: string, status: BacklotClearanceStatus) => {
    await updateStatus.mutateAsync({
      id,
      status,
      signedDate: status === 'signed' ? new Date().toISOString().split('T')[0] : undefined,
    });
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates?.find((t) => t.id === templateId);
    if (template) {
      setFormData({
        ...formData,
        type: template.type,
        title: template.name,
        description: template.description || '',
        notes: template.default_notes || '',
      });
    }
  };

  // Determine which related field to show based on type
  const showPersonField = ['talent_release', 'appearance_release', 'nda'].includes(formData.type);
  const showLocationField = formData.type === 'location_release';
  const showAssetField = ['music_license', 'stock_license', 'other_contract'].includes(formData.type);

  // Show detail view when a clearance is selected
  if (selectedClearanceId) {
    return (
      <ClearanceDetailView
        projectId={projectId}
        clearanceId={selectedClearanceId}
        canEdit={canEdit}
        onBack={() => setSelectedClearanceId(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Clearances</h2>
          <p className="text-sm text-muted-gray">Track releases, contracts, and licenses</p>
        </div>
        <div className="flex gap-3">
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Clearance
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <ClearanceStats projectId={projectId} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search clearances..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-64 bg-charcoal-black/50 border-muted-gray/30"
        />
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40 bg-charcoal-black/50 border-muted-gray/30">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(CLEARANCE_STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Person Filter Chip */}
        {personFilter && personFilterName && (
          <Badge
            variant="outline"
            className="bg-primary-red/10 text-primary-red border-primary-red/30 px-3 py-1.5 flex items-center gap-2"
          >
            <User className="w-3 h-3" />
            <span>Showing clearances for: {personFilterName}</span>
            {onClearPersonFilter && (
              <button
                onClick={onClearPersonFilter}
                className="ml-1 hover:bg-primary-red/20 rounded-full p-0.5"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
          </Badge>
        )}
      </div>

      {/* Expiring Clearances Alert */}
      <ExpiringClearancesAlert
        projectId={projectId}
        days={90}
        onClearanceClick={(id) => setSelectedClearanceId(id)}
      />

      {/* Tabs for type groups */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/20">
          <TabsTrigger value="all">All</TabsTrigger>
          {(Object.keys(CLEARANCE_TYPE_GROUPS) as Array<keyof typeof CLEARANCE_TYPE_GROUPS>).map((group) => (
            <TabsTrigger key={group} value={group}>
              {CLEARANCE_TYPE_GROUP_LABELS[group]}
            </TabsTrigger>
          ))}
          <TabsTrigger value="eo" className="gap-1">
            <FileCheck className="w-3.5 h-3.5" />
            E&O Checklist
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-1">
            <Package className="w-3.5 h-3.5" />
            Packages
          </TabsTrigger>
        </TabsList>

        {/* E&O Checklist Tab */}
        <TabsContent value="eo" className="mt-6">
          <EOChecklistView
            projectId={projectId}
            clearances={clearances.map((c) => ({ id: c.id, title: c.title, status: c.status }))}
          />
        </TabsContent>

        {/* Document Packages Tab */}
        <TabsContent value="packages" className="mt-6">
          <DocumentPackagesView projectId={projectId} canEdit={canEdit} />
        </TabsContent>

        {/* Clearances List Tabs */}
        <TabsContent value={activeTab} className="mt-6">
          {activeTab === 'eo' || activeTab === 'packages' ? null : filteredClearances.length > 0 ? (
            activeTab === 'all' ? (
              // Matrix view: grouped by type
              <div className="space-y-8">
                {Object.entries(clearancesByType).map(([type, items]) => {
                  if (items.length === 0) return null;
                  return (
                    <div key={type}>
                      <h3 className="text-lg font-medium text-bone-white mb-3 flex items-center gap-2">
                        {CLEARANCE_TYPE_LABELS[type as BacklotClearanceType]}
                        <Badge variant="outline" className="text-xs border-muted-gray/30">
                          {items.length}
                        </Badge>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item) => (
                          <ClearanceCard
                            key={item.id}
                            item={item}
                            canEdit={canEdit}
                            onEdit={handleOpenForm}
                            onDelete={handleDelete}
                            onStatusChange={handleStatusChange}
                            onClick={(item) => setSelectedClearanceId(item.id)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Flat list for filtered tab
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClearances.map((item) => (
                  <ClearanceCard
                    key={item.id}
                    item={item}
                    canEdit={canEdit}
                    onEdit={handleOpenForm}
                    onDelete={handleDelete}
                    onStatusChange={handleStatusChange}
                    onClick={(item) => setSelectedClearanceId(item.id)}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
              <FileCheck className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-bone-white mb-2">No clearances yet</h3>
              <p className="text-muted-gray mb-4">
                Add releases and contracts to track your clearance status.
              </p>
              {canEdit && (
                <Button
                  onClick={() => handleOpenForm()}
                  className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Clearance
                </Button>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Clearance Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Clearance' : 'Add Clearance'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {/* Template Selection (only for new items) */}
            {!editingItem && templates && templates.length > 0 && (
              <div className="space-y-2">
                <Label>Start from Template</Label>
                <Select onValueChange={handleTemplateSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as BacklotClearanceType })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLEARANCE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as BacklotClearanceStatus })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLEARANCE_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder="e.g., John Doe - Talent Release"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Details about this clearance..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            {/* Conditional Related Fields */}
            {showPersonField && (
              <div className="space-y-2">
                <Label htmlFor="related_person_name">Person Name</Label>
                <Input
                  id="related_person_name"
                  placeholder="Name of person this release is for"
                  value={formData.related_person_name || ''}
                  onChange={(e) => setFormData({ ...formData, related_person_name: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {showLocationField && (
              <div className="space-y-2">
                <Label htmlFor="related_location_id">Location</Label>
                <Select
                  value={formData.related_location_id || ''}
                  onValueChange={(v) => setFormData({ ...formData, related_location_id: v })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="related_location_id">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map((loc) => (
                      <SelectItem key={loc.location?.id || loc.id} value={loc.location?.id || loc.id}>
                        {loc.location?.name || loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showAssetField && (
              <div className="space-y-2">
                <Label htmlFor="related_asset_label">Asset/License Name</Label>
                <Input
                  id="related_asset_label"
                  placeholder="e.g., Song title, Stock clip ID"
                  value={formData.related_asset_label || ''}
                  onChange={(e) => setFormData({ ...formData, related_asset_label: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_date">Requested</Label>
                <Input
                  id="requested_date"
                  type="date"
                  value={formData.requested_date || ''}
                  onChange={(e) => setFormData({ ...formData, requested_date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signed_date">Signed</Label>
                <Input
                  id="signed_date"
                  type="date"
                  value={formData.signed_date || ''}
                  onChange={(e) => setFormData({ ...formData, signed_date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiration_date">Expires</Label>
                <Input
                  id="expiration_date"
                  type="date"
                  value={formData.expiration_date || ''}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Contact Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="contact@email.com"
                  value={formData.contact_email || ''}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Contact Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.contact_phone || ''}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={isSubmitting}
                rows={2}
              />
            </div>

            {/* Document Upload Section */}
            <div className="space-y-2 p-4 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
              <Label>Document</Label>
              {editingItem ? (
                <ClearanceDocumentUpload
                  clearanceId={editingItem.id}
                  currentFileUrl={editingItem.file_url}
                  currentFileName={editingItem.file_name}
                  isSensitive={editingItem.file_is_sensitive}
                  disabled={isSubmitting}
                />
              ) : (
                <PendingDocumentUpload
                  file={pendingFile}
                  onFileSelect={setPendingFile}
                  onRemove={() => setPendingFile(null)}
                  disabled={isSubmitting}
                />
              )}
              <p className="text-xs text-muted-foreground">
                {editingItem
                  ? 'Upload or replace the document for this clearance'
                  : 'Optionally attach a document. It will be uploaded after the clearance is created.'}
              </p>
            </div>

            {/* Sensitive File Toggle */}
            <div className="flex items-center justify-between py-2">
              <Label htmlFor="file_is_sensitive">Sensitive document (restrict downloads)</Label>
              <Switch
                id="file_is_sensitive"
                checked={formData.file_is_sensitive}
                onCheckedChange={(checked) => setFormData({ ...formData, file_is_sensitive: checked })}
                disabled={isSubmitting}
              />
            </div>

            {/* Recipients Section (for new clearances only) */}
            {!editingItem && (
              <div className="space-y-2 p-4 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
                <div className="flex items-center justify-between">
                  <Label>Recipients (optional)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRecipientPicker(true)}
                    disabled={isSubmitting}
                    className="border-primary-red/50 text-primary-red hover:bg-primary-red/10"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Recipient
                  </Button>
                </div>
                {pendingRecipients.length > 0 && (
                  <PendingRecipientsList
                    recipients={pendingRecipients}
                    onRemove={(id) => setPendingRecipients(prev => prev.filter(r => r.id !== id))}
                    onToggleSignature={(id) =>
                      setPendingRecipients(prev =>
                        prev.map(r => r.id === id ? { ...r, requires_signature: !r.requires_signature } : r)
                      )
                    }
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  Recipients will be added after the clearance is created.
                </p>
              </div>
            )}

            {/* Send After Save Toggle (only for new with document and recipients) */}
            {!editingItem && pendingFile && pendingRecipients.length > 0 && (
              <div className="flex items-center justify-between py-3 px-4 bg-accent-yellow/10 rounded-lg border border-accent-yellow/30">
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-accent-yellow" />
                  <Label htmlFor="send_after_save" className="text-sm cursor-pointer">
                    Open send dialog after saving
                  </Label>
                </div>
                <Switch
                  id="send_after_save"
                  checked={sendAfterSave}
                  onCheckedChange={setSendAfterSave}
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* History Section (only for editing existing clearance) */}
            {editingItem && (
              <div className="space-y-2 p-4 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
                <Label>Change History</Label>
                <ClearanceHistoryTimeline clearanceId={editingItem.id} maxHeight="200px" />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.title.trim()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingItem ? (
                  'Save Changes'
                ) : (
                  'Add Clearance'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Recipient Picker Modal */}
      <RecipientPicker
        projectId={projectId}
        open={showRecipientPicker}
        onOpenChange={setShowRecipientPicker}
        onAdd={(recipient) => {
          setPendingRecipients((prev) => [...prev, recipient]);
        }}
        excludeContactIds={pendingRecipients
          .filter((r) => r.project_contact_id)
          .map((r) => r.project_contact_id!)}
        excludeMemberIds={pendingRecipients
          .filter((r) => r.project_member_user_id)
          .map((r) => r.project_member_user_id!)}
      />

      {/* Send Modal (after creation) */}
      {newClearanceForSend && (
        <ClearanceSendModal
          open={showSendModal}
          onOpenChange={(open) => {
            setShowSendModal(open);
            if (!open) {
              setNewClearanceForSend(null);
            }
          }}
          clearanceId={newClearanceForSend.id}
          clearanceTitle={newClearanceForSend.title}
        />
      )}
    </div>
  );
};

export default ClearancesView;
