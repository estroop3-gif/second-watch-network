import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Link2, Phone, Mail, Building2,
  MapPin, Tag, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TemperatureBadge from '@/components/crm/TemperatureBadge';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import ActivityForm from '@/components/crm/ActivityForm';
import ContactForm from '@/components/crm/ContactForm';
import LinkProfileDialog from '@/components/crm/LinkProfileDialog';
import EmailThreadList from '@/components/crm/EmailThreadList';
import CopyableEmail from '@/components/crm/CopyableEmail';
import SequenceEnrollButton from '@/components/crm/SequenceEnrollButton';
import { useContact, useUpdateContact, useDeleteContact, useLinkProfile } from '@/hooks/crm';
import { useCreateActivity } from '@/hooks/crm';
import { useContactThreads } from '@/hooks/crm/useEmail';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { toast } from 'sonner';

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: contact, isLoading } = useContact(id);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const linkProfile = useLinkProfile();
  const createActivity = useCreateActivity();

  const { data: contactThreadsData, isLoading: threadsLoading } = useContactThreads(id || '');

  const { openCompose } = useEmailCompose();

  const [showEdit, setShowEdit] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!contact) {
    return <div className="text-center py-12 text-muted-gray">Contact not found</div>;
  }

  const handleUpdate = async (values: any) => {
    try {
      await updateContact.mutateAsync({ id: id!, data: values });
      setShowEdit(false);
      toast.success('Contact updated');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Deactivate this contact?')) return;
    try {
      await deleteContact.mutateAsync(id!);
      toast.success('Contact deactivated');
      navigate('/crm/contacts');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLink = async (profileId: string) => {
    try {
      await linkProfile.mutateAsync({ contactId: id!, profileId });
      setShowLink(false);
      toast.success('Profile linked');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleLogActivity = async (data: any) => {
    try {
      await createActivity.mutateAsync(data);
      setShowLogActivity(false);
      toast.success('Activity logged');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const address = [contact.address_line1, contact.city, contact.state, contact.zip]
    .filter(Boolean)
    .join(', ');

  const statusBadge = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    do_not_contact: 'bg-red-500/20 text-red-400 border-red-500/30',
  }[contact.status] || '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/contacts')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-heading text-bone-white">
            {contact.first_name} {contact.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <TemperatureBadge temperature={contact.temperature} />
            <Badge variant="outline" className={statusBadge}>
              {contact.status.replace('_', ' ')}
            </Badge>
            {contact.source && (
              <Badge variant="outline" className="border-muted-gray/30 text-muted-gray">
                {contact.source}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {contact.email && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCompose({
                defaultTo: contact.email,
                contactId: id,
                contactData: {
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                  company: contact.company,
                  email: contact.email,
                },
              })}
              className="border-accent-yellow text-accent-yellow hover:bg-accent-yellow/10"
            >
              <Mail className="h-4 w-4 mr-1" /> Send Email
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowLink(true)}>
            <Link2 className="h-4 w-4 mr-1" /> Link Profile
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader>
            <CardTitle className="text-bone-white text-base">Contact Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2 text-bone-white/80">
                <Mail className="h-4 w-4 text-muted-gray" />
                <CopyableEmail email={contact.email} className="hover:text-accent-yellow" />
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-bone-white/80">
                <Phone className="h-4 w-4 text-muted-gray" />
                <a href={`tel:${contact.phone}`} className="hover:text-accent-yellow">{contact.phone}</a>
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-bone-white/80">
                <Building2 className="h-4 w-4 text-muted-gray" />
                {contact.company}{contact.job_title && ` - ${contact.job_title}`}
              </div>
            )}
            {address && (
              <div className="flex items-center gap-2 text-bone-white/80">
                <MapPin className="h-4 w-4 text-muted-gray" />
                {address}
              </div>
            )}
            {contact.tags?.length > 0 && (
              <div className="flex items-start gap-2">
                <Tag className="h-4 w-4 text-muted-gray mt-0.5" />
                <div className="flex flex-wrap gap-1">
                  {contact.tags.map((tag: string) => (
                    <span key={tag} className="inline-block rounded-full bg-muted-gray/20 px-2 py-0.5 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {contact.linked_profile_name && (
              <div className="mt-3 p-2 rounded bg-accent-yellow/10 border border-accent-yellow/20">
                <div className="text-xs text-accent-yellow">Linked SWN Profile</div>
                <div className="text-sm text-bone-white">{contact.linked_profile_name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-bone-white text-base">Notes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-bone-white/70 whitespace-pre-wrap">
                {contact.notes || 'No notes yet.'}
              </p>
              {contact.assigned_rep_name && (
                <div className="mt-4 text-xs text-muted-gray">
                  Assigned to: <span className="text-bone-white">{contact.assigned_rep_name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activities */}
      <Tabs defaultValue="timeline">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted-gray/10">
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="sequences">Sequences</TabsTrigger>
            <TabsTrigger value="log">Log Activity</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="timeline" className="mt-4">
          <ActivityTimeline activities={contact.activities || []} />
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="pt-4">
              {threadsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : contactThreadsData?.threads?.length ? (
                <EmailThreadList
                  threads={contactThreadsData.threads}
                  onSelectThread={(threadId) => navigate(`/crm/email?thread=${threadId}`)}
                />
              ) : (
                <div className="py-8 text-center">
                  <p className="text-muted-gray text-sm mb-3">No email threads with this contact yet.</p>
                  {contact.email && (
                    <Button
                      size="sm"
                      onClick={() => openCompose({
                        defaultTo: contact.email,
                        contactId: id,
                        contactData: {
                          first_name: contact.first_name,
                          last_name: contact.last_name,
                          company: contact.company,
                          email: contact.email,
                        },
                      })}
                      className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
                    >
                      <Mail className="h-4 w-4 mr-1" /> Compose
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sequences" className="mt-4">
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader>
              <CardTitle className="text-bone-white text-base">Email Sequences</CardTitle>
            </CardHeader>
            <CardContent>
              <SequenceEnrollButton contactId={id!} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="log" className="mt-4">
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardContent className="pt-6">
              <ActivityForm
                contactId={id!}
                onSubmit={handleLogActivity}
                isSubmitting={createActivity.isPending}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-bone-white">Edit Contact</DialogTitle>
          </DialogHeader>
          <ContactForm
            defaultValues={contact}
            onSubmit={handleUpdate}
            isSubmitting={updateContact.isPending}
            submitLabel="Update Contact"
          />
        </DialogContent>
      </Dialog>

      {/* Link Profile Dialog */}
      <LinkProfileDialog
        open={showLink}
        onOpenChange={setShowLink}
        contactId={id!}
        onLink={handleLink}
        isLinking={linkProfile.isPending}
      />
    </div>
  );
};

export default ContactDetail;
