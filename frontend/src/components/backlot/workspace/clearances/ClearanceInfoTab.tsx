/**
 * ClearanceInfoTab - Editable clearance details form
 * Grouped form sections for better organization
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Save,
  User,
  MapPin,
  Tag,
  Calendar,
  Mail,
  Phone,
  FileText,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useClearances, useProjectLocations } from '@/hooks/backlot';
import {
  BacklotClearanceItem,
  BacklotClearanceType,
  BacklotClearanceStatus,
  ClearanceItemInput,
  ClearancePriority,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_STATUS_LABELS,
  CLEARANCE_PRIORITY_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';

interface ClearanceInfoTabProps {
  projectId: string;
  clearance: BacklotClearanceItem;
  canEdit: boolean;
}

export default function ClearanceInfoTab({
  projectId,
  clearance,
  canEdit,
}: ClearanceInfoTabProps) {
  const { updateClearance } = useClearances({ projectId });
  const { data: locations } = useProjectLocations(projectId);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ClearanceItemInput>({
    type: clearance.type,
    title: clearance.title,
    description: clearance.description,
    status: clearance.status,
    related_person_id: clearance.related_person_id,
    related_person_name: clearance.related_person_name,
    related_location_id: clearance.related_location_id,
    related_project_location_id: clearance.related_project_location_id,
    related_asset_label: clearance.related_asset_label,
    requested_date: clearance.requested_date,
    signed_date: clearance.signed_date,
    expiration_date: clearance.expiration_date,
    contact_email: clearance.contact_email,
    contact_phone: clearance.contact_phone,
    notes: clearance.notes,
    priority: clearance.priority,
    is_eo_critical: clearance.is_eo_critical,
    file_is_sensitive: clearance.file_is_sensitive,
  });

  // Reset form when clearance changes
  useEffect(() => {
    setFormData({
      type: clearance.type,
      title: clearance.title,
      description: clearance.description,
      status: clearance.status,
      related_person_id: clearance.related_person_id,
      related_person_name: clearance.related_person_name,
      related_location_id: clearance.related_location_id,
      related_project_location_id: clearance.related_project_location_id,
      related_asset_label: clearance.related_asset_label,
      requested_date: clearance.requested_date,
      signed_date: clearance.signed_date,
      expiration_date: clearance.expiration_date,
      contact_email: clearance.contact_email,
      contact_phone: clearance.contact_phone,
      notes: clearance.notes,
      priority: clearance.priority,
      is_eo_critical: clearance.is_eo_critical,
      file_is_sensitive: clearance.file_is_sensitive,
    });
    setIsEditing(false);
  }, [clearance]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateClearance(clearance.id, formData);
      toast.success('Clearance updated');
      setIsEditing(false);
    } catch (error) {
      toast.error('Failed to update clearance', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      type: clearance.type,
      title: clearance.title,
      description: clearance.description,
      status: clearance.status,
      related_person_id: clearance.related_person_id,
      related_person_name: clearance.related_person_name,
      related_location_id: clearance.related_location_id,
      related_project_location_id: clearance.related_project_location_id,
      related_asset_label: clearance.related_asset_label,
      requested_date: clearance.requested_date,
      signed_date: clearance.signed_date,
      expiration_date: clearance.expiration_date,
      contact_email: clearance.contact_email,
      contact_phone: clearance.contact_phone,
      notes: clearance.notes,
      priority: clearance.priority,
      is_eo_critical: clearance.is_eo_critical,
      file_is_sensitive: clearance.file_is_sensitive,
    });
    setIsEditing(false);
  };

  const showPersonField = ['talent_release', 'appearance_release', 'nda'].includes(formData.type);
  const showLocationField = formData.type === 'location_release';
  const showAssetField = ['music_license', 'stock_license', 'other_contract'].includes(formData.type);

  return (
    <div className="space-y-6">
      {/* Edit Controls */}
      {canEdit && (
        <div className="flex justify-end gap-2">
          {isEditing ? (
            <>
              <Button variant="ghost" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit Details
            </Button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!isEditing}
                className={cn(!isEditing && 'bg-transparent border-transparent')}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as BacklotClearanceType })}
                  disabled={!isEditing}
                >
                  <SelectTrigger id="type" className={cn(!isEditing && 'bg-transparent border-transparent')}>
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
                  disabled={!isEditing}
                >
                  <SelectTrigger id="status" className={cn(!isEditing && 'bg-transparent border-transparent')}>
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
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!isEditing}
                rows={3}
                className={cn(!isEditing && 'bg-transparent border-transparent resize-none')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Related Entity Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              {showPersonField ? <User className="w-4 h-4" /> :
               showLocationField ? <MapPin className="w-4 h-4" /> :
               <FileText className="w-4 h-4" />}
              Related Entity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {showPersonField && (
              <div className="space-y-2">
                <Label htmlFor="related_person_name">Person Name</Label>
                <Input
                  id="related_person_name"
                  placeholder="Name of person this release is for"
                  value={formData.related_person_name || ''}
                  onChange={(e) => setFormData({ ...formData, related_person_name: e.target.value })}
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
            )}

            {showLocationField && (
              <div className="space-y-2">
                <Label htmlFor="related_location_id">Location</Label>
                <Select
                  value={formData.related_location_id || ''}
                  onValueChange={(v) => setFormData({ ...formData, related_location_id: v })}
                  disabled={!isEditing}
                >
                  <SelectTrigger className={cn(!isEditing && 'bg-transparent border-transparent')}>
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
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
            )}

            {!showPersonField && !showLocationField && !showAssetField && (
              <p className="text-sm text-muted-foreground">
                No related entity for this clearance type.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Dates Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Important Dates
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="requested_date">Requested</Label>
                <Input
                  id="requested_date"
                  type="date"
                  value={formData.requested_date || ''}
                  onChange={(e) => setFormData({ ...formData, requested_date: e.target.value })}
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signed_date">Signed</Label>
                <Input
                  id="signed_date"
                  type="date"
                  value={formData.signed_date || ''}
                  onChange={(e) => setFormData({ ...formData, signed_date: e.target.value })}
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiration_date">Expires</Label>
                <Input
                  id="expiration_date"
                  type="date"
                  value={formData.expiration_date || ''}
                  onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  placeholder="contact@email.com"
                  value={formData.contact_email || ''}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Phone</Label>
                <Input
                  id="contact_phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={formData.contact_phone || ''}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  disabled={!isEditing}
                  className={cn(!isEditing && 'bg-transparent border-transparent')}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workflow Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Workflow & Priority
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority || 'normal'}
                onValueChange={(v) => setFormData({ ...formData, priority: v as ClearancePriority })}
                disabled={!isEditing}
              >
                <SelectTrigger className={cn(!isEditing && 'bg-transparent border-transparent')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CLEARANCE_PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <Label htmlFor="is_eo_critical" className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  E&O Critical
                </Label>
                <p className="text-xs text-muted-foreground">
                  Mark if required for E&O insurance
                </p>
              </div>
              <Switch
                id="is_eo_critical"
                checked={formData.is_eo_critical}
                onCheckedChange={(checked) => setFormData({ ...formData, is_eo_critical: checked })}
                disabled={!isEditing}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <Label htmlFor="file_is_sensitive">
                  Sensitive Document
                </Label>
                <p className="text-xs text-muted-foreground">
                  Restrict download access
                </p>
              </div>
              <Switch
                id="file_is_sensitive"
                checked={formData.file_is_sensitive}
                onCheckedChange={(checked) => setFormData({ ...formData, file_is_sensitive: checked })}
                disabled={!isEditing}
              />
            </div>
          </CardContent>
        </Card>

        {/* Notes Card - Full Width */}
        <Card className="bg-charcoal-black border-muted-gray/30 lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={!isEditing}
              rows={4}
              className={cn(!isEditing && 'bg-transparent border-transparent resize-none')}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
