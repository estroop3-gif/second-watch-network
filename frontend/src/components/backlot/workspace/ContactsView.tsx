/**
 * ContactsView - Manage project contacts pipeline (investors, crew, collaborators)
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
  Users,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  Building,
  Calendar,
  MessageSquare,
  Loader2,
  DollarSign,
  Briefcase,
  Handshake,
  Package,
  Star,
  Archive,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useContacts, useContactStats } from '@/hooks/backlot';
import {
  BacklotProjectContact,
  ProjectContactInput,
  BacklotContactType,
  BacklotContactStatus,
} from '@/types/backlot';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ContactsViewProps {
  projectId: string;
  canEdit: boolean;
}

const TYPE_CONFIG: Record<BacklotContactType, { label: string; icon: React.ElementType; color: string }> = {
  investor: { label: 'Investor', icon: DollarSign, color: 'text-green-400 border-green-500/30' },
  crew: { label: 'Crew', icon: Briefcase, color: 'text-blue-400 border-blue-500/30' },
  collaborator: { label: 'Collaborator', icon: Handshake, color: 'text-purple-400 border-purple-500/30' },
  vendor: { label: 'Vendor', icon: Package, color: 'text-orange-400 border-orange-500/30' },
  talent: { label: 'Talent', icon: Star, color: 'text-accent-yellow border-accent-yellow/30' },
  other: { label: 'Other', icon: Users, color: 'text-muted-gray border-muted-gray/30' },
};

const STATUS_CONFIG: Record<BacklotContactStatus, { label: string; color: string }> = {
  new: { label: 'New', color: 'bg-blue-500/20 text-blue-400' },
  contacted: { label: 'Contacted', color: 'bg-purple-500/20 text-purple-400' },
  in_discussion: { label: 'In Discussion', color: 'bg-orange-500/20 text-orange-400' },
  confirmed: { label: 'Confirmed', color: 'bg-green-500/20 text-green-400' },
  declined: { label: 'Declined', color: 'bg-red-500/20 text-red-400' },
  archived: { label: 'Archived', color: 'bg-muted-gray/20 text-muted-gray' },
};

const ContactCard: React.FC<{
  contact: BacklotProjectContact;
  canEdit: boolean;
  onEdit: (contact: BacklotProjectContact) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: BacklotContactStatus) => void;
}> = ({ contact, canEdit, onEdit, onDelete, onStatusChange }) => {
  const typeConfig = TYPE_CONFIG[contact.contact_type];
  const statusConfig = STATUS_CONFIG[contact.status];
  const TypeIcon = typeConfig.icon;

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Name & Type */}
          <div className="flex items-center gap-2 mb-1">
            <TypeIcon className={cn('w-4 h-4 shrink-0', typeConfig.color.split(' ')[0])} />
            <h4 className="font-medium text-bone-white truncate">{contact.name}</h4>
            <Badge variant="outline" className={cn('text-xs shrink-0', statusConfig.color)}>
              {statusConfig.label}
            </Badge>
          </div>

          {/* Company & Role */}
          <div className="flex flex-wrap gap-2 text-sm text-muted-gray mb-2">
            {contact.company && (
              <span className="flex items-center gap-1">
                <Building className="w-3 h-3" />
                {contact.company}
              </span>
            )}
            {contact.role_interest && (
              <span className="text-bone-white/70">{contact.role_interest}</span>
            )}
          </div>

          {/* Contact Info */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-gray">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-1 hover:text-accent-yellow"
              >
                <Mail className="w-3 h-3" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-1 hover:text-accent-yellow"
              >
                <Phone className="w-3 h-3" />
                {contact.phone}
              </a>
            )}
          </div>

          {/* Dates */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-gray mt-2">
            {contact.last_contact_date && (
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Last contact: {format(new Date(contact.last_contact_date), 'MMM d')}
              </span>
            )}
            {contact.next_follow_up_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Follow up: {format(new Date(contact.next_follow_up_date), 'MMM d')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(contact)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => onStatusChange(contact.id, value as BacklotContactStatus)}
                  disabled={contact.status === value}
                >
                  {config.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-400" onClick={() => onDelete(contact.id)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Notes Preview */}
      {contact.notes && (
        <p className="text-xs text-muted-gray mt-3 pt-3 border-t border-muted-gray/10 line-clamp-2">
          {contact.notes}
        </p>
      )}
    </div>
  );
};

const ContactsView: React.FC<ContactsViewProps> = ({ projectId, canEdit }) => {
  const [typeFilter, setTypeFilter] = useState<BacklotContactType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<BacklotContactStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const { contacts, isLoading, createContact, updateContact, updateStatus, deleteContact } =
    useContacts({
      projectId,
      contact_type: typeFilter,
      status: statusFilter,
      search: search || undefined,
    });

  const { data: stats } = useContactStats(projectId);

  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<BacklotProjectContact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<ProjectContactInput>({
    name: '',
    contact_type: 'other',
    status: 'new',
    company: '',
    email: '',
    phone: '',
    role_interest: '',
    notes: '',
    source: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      contact_type: 'other',
      status: 'new',
      company: '',
      email: '',
      phone: '',
      role_interest: '',
      notes: '',
      source: '',
    });
  };

  const handleOpenForm = (contact?: BacklotProjectContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        name: contact.name,
        contact_type: contact.contact_type,
        status: contact.status,
        company: contact.company || '',
        email: contact.email || '',
        phone: contact.phone || '',
        role_interest: contact.role_interest || '',
        notes: contact.notes || '',
        source: contact.source || '',
      });
    } else {
      setEditingContact(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingContact) {
        await updateContact.mutateAsync({
          id: editingContact.id,
          ...formData,
        });
      } else {
        await createContact.mutateAsync({
          projectId,
          ...formData,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Failed to save contact:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      await deleteContact.mutateAsync(id);
    }
  };

  const handleStatusChange = async (id: string, status: BacklotContactStatus) => {
    await updateStatus.mutateAsync({ id, status });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
          <h2 className="text-2xl font-heading text-bone-white">Contacts</h2>
          <p className="text-sm text-muted-gray">
            Manage your project contacts and pipeline
            {stats && ` (${stats.total} total, ${stats.needs_followup} need follow-up)`}
          </p>
        </div>
        {canEdit && (
          <Button
            onClick={() => handleOpenForm()}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-charcoal-black/50 border-muted-gray/30"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as BacklotContactType | 'all')}>
          <SelectTrigger className="w-full sm:w-40 bg-charcoal-black/50 border-muted-gray/30">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as BacklotContactStatus | 'all')}
        >
          <SelectTrigger className="w-full sm:w-40 bg-charcoal-black/50 border-muted-gray/30">
            <SelectValue placeholder="All Statuses" />
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
      </div>

      {/* Contacts List */}
      {contacts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              canEdit={canEdit}
              onEdit={handleOpenForm}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
          <Users className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-bone-white mb-2">No contacts yet</h3>
          <p className="text-muted-gray mb-4">
            Add contacts to track investors, crew, and collaborators.
          </p>
          {canEdit && (
            <Button
              onClick={() => handleOpenForm()}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          )}
        </div>
      )}

      {/* Contact Form Modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Contact name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_type">Type</Label>
                <Select
                  value={formData.contact_type}
                  onValueChange={(v) => setFormData({ ...formData, contact_type: v as BacklotContactType })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="contact_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as BacklotContactStatus })}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                      <SelectItem key={value} value={value}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                placeholder="Company name"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role_interest">Role/Interest</Label>
              <Input
                id="role_interest"
                placeholder="What role or involvement?"
                value={formData.role_interest}
                onChange={(e) => setFormData({ ...formData, role_interest: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input
                id="source"
                placeholder="How did you meet? (referral, website, etc.)"
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !formData.name.trim()}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : editingContact ? (
                  'Save Changes'
                ) : (
                  'Add Contact'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactsView;
