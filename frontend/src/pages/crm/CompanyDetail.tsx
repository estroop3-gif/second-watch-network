import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Globe, Mail, Phone, MapPin, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import ContactCard from '@/components/crm/ContactCard';
import { useCRMCompany, useUpdateCRMCompany, useDeleteCRMCompany } from '@/hooks/crm/useCompanies';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

const CompanyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { openCompose } = useEmailCompose();

  const { data: company, isLoading } = useCRMCompany(id);
  const updateCompany = useUpdateCRMCompany();
  const deleteCompany = useDeleteCRMCompany();

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const handleEmail = (contact: any) => {
    openCompose({
      defaultTo: contact.email,
      contactId: contact.id,
      contactData: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        company: contact.company,
        email: contact.email,
      },
    });
  };

  const handleEdit = () => {
    setEditForm({
      name: company?.name || '',
      website: company?.website || '',
      email: company?.email || '',
      phone: company?.phone || '',
      address_line1: company?.address_line1 || '',
      address_line2: company?.address_line2 || '',
      city: company?.city || '',
      state: company?.state || '',
      zip: company?.zip || '',
      country: company?.country || 'US',
      description: company?.description || '',
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    try {
      await updateCompany.mutateAsync({ id: id!, data: editForm });
      setShowEdit(false);
      toast.success('Company updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update company');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this company? Contacts will be unlinked but not deleted.')) return;
    try {
      await deleteCompany.mutateAsync(id!);
      toast.success('Company deleted');
      navigate('/crm/contacts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete company');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12 text-muted-gray">
        <p className="text-lg">Company not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/crm/contacts')}>Back to Contacts</Button>
      </div>
    );
  }

  const contacts = company.contacts || [];
  const address = [company.address_line1, company.address_line2, company.city, company.state, company.zip].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Building2 className="h-6 w-6 text-accent-yellow" />
          <h1 className="text-2xl font-heading text-bone-white">{company.name}</h1>
          {company.tags?.length > 0 && company.tags.map((tag: string) => (
            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          )}
        </div>
      </div>

      {/* Company Info */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {company.website && (
              <div className="flex items-center gap-2 text-muted-gray">
                <Globe className="h-4 w-4 flex-shrink-0" />
                <a href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline truncate">
                  {company.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {company.email && (
              <div className="flex items-center gap-2 text-muted-gray">
                <Mail className="h-4 w-4 flex-shrink-0" />
                <span>{company.email}</span>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-2 text-muted-gray">
                <Phone className="h-4 w-4 flex-shrink-0" />
                <span>{company.phone}</span>
              </div>
            )}
            {address && (
              <div className="flex items-center gap-2 text-muted-gray md:col-span-3">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{address}</span>
              </div>
            )}
          </div>
          {company.description && (
            <p className="mt-3 text-sm text-muted-gray">{company.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Linked Contacts */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-bone-white text-lg">
            Contacts ({contacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-gray py-4 text-center">No contacts linked to this company yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map((contact: any) => (
                <ContactCard
                  key={contact.id}
                  contact={contact}
                  onEmail={contact.email ? handleEmail : undefined}
                  showAdminControls={isAdmin}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="bg-charcoal-black border-muted-gray max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Edit Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray">Name *</label>
              <Input value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="bg-charcoal-black border-muted-gray" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-gray">Website</label>
                <Input value={editForm.website || ''} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="bg-charcoal-black border-muted-gray" />
              </div>
              <div>
                <label className="text-sm text-muted-gray">Email</label>
                <Input value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="bg-charcoal-black border-muted-gray" />
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-gray">Phone</label>
              <Input value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} className="bg-charcoal-black border-muted-gray" />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Address</label>
              <Input value={editForm.address_line1 || ''} onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })} placeholder="Street address" className="bg-charcoal-black border-muted-gray" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input value={editForm.city || ''} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} placeholder="City" className="bg-charcoal-black border-muted-gray" />
              <Input value={editForm.state || ''} onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} placeholder="State" className="bg-charcoal-black border-muted-gray" />
              <Input value={editForm.zip || ''} onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })} placeholder="ZIP" className="bg-charcoal-black border-muted-gray" />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Description</label>
              <Textarea value={editForm.description || ''} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="bg-charcoal-black border-muted-gray" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateCompany.isPending} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              {updateCompany.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CompanyDetail;
