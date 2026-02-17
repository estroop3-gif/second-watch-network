import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit, Link2, Phone, Mail, Building2,
  MapPin, Tag, Trash2, PhoneOff, ClipboardList,
  MessageSquare, UserPlus, Lock, Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TemperatureBadge from '@/components/crm/TemperatureBadge';
import ActivityTimeline from '@/components/crm/ActivityTimeline';
import ContactForm from '@/components/crm/ContactForm';
import LinkProfileDialog from '@/components/crm/LinkProfileDialog';
import EmailThreadList from '@/components/crm/EmailThreadList';
import CopyableEmail from '@/components/crm/CopyableEmail';
import SequenceEnrollButton from '@/components/crm/SequenceEnrollButton';
import CalendarActivityDialog from '@/components/crm/CalendarActivityDialog';
import ContactNotes from '@/components/crm/ContactNotes';
import ContactAssignmentDialog from '@/components/crm/ContactAssignmentDialog';
import AssignmentHistoryTimeline from '@/components/crm/AssignmentHistoryTimeline';
import { useContact, useUpdateContact, useDeleteContact, useLinkProfile } from '@/hooks/crm';
import { useCreateActivity, useUpdateContactDNC } from '@/hooks/crm';
import { useContactThreads } from '@/hooks/crm/useEmail';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';

const ContactDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile: currentProfile } = useEnrichedProfile();
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { data: contact, isLoading } = useContact(id);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const linkProfile = useLinkProfile();
  const createActivity = useCreateActivity();
  const updateDNC = useUpdateContactDNC();

  const { data: contactThreadsData, isLoading: threadsLoading } = useContactThreads(id || '');

  const { openCompose } = useEmailCompose();

  const [showEdit, setShowEdit] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [showDNC, setShowDNC] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [dncForm, setDncForm] = useState({
    do_not_email: false,
    do_not_call: false,
    do_not_text: false,
  });

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

  const openDNCDialog = () => {
    setDncForm({
      do_not_email: !!contact.do_not_email,
      do_not_call: !!contact.do_not_call,
      do_not_text: !!contact.do_not_text,
    });
    setShowDNC(true);
  };

  const saveDNC = () => {
    updateDNC.mutate(
      { contactId: id!, data: dncForm },
      {
        onSuccess: () => {
          setShowDNC(false);
          toast.success('DNC flags updated');
        },
      }
    );
  };

  const isOwner = currentProfile?.id === contact.assigned_rep_id;
  const canEdit = isOwner || isAdmin;

  const isDNC = contact.do_not_call || contact.do_not_email || contact.do_not_text;

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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-heading text-bone-white">
              {contact.first_name}{contact.last_name ? ` ${contact.last_name}` : ''}
            </h1>
            {contact.visibility === 'private' && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30">
                <Lock className="h-3 w-3 mr-1" /> Private
              </Badge>
            )}
            {isDNC && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/30">
                DNC
              </Badge>
            )}
          </div>
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
        <div className="flex gap-2 flex-wrap justify-end items-center">
          {canEdit && (
            <div className="flex items-center gap-2 mr-2 px-2 py-1 rounded border border-muted-gray/30">
              <Label className="text-xs text-muted-gray flex items-center gap-1 cursor-pointer">
                {contact.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {contact.visibility === 'private' ? 'Private' : 'Team'}
              </Label>
              <Switch
                checked={contact.visibility === 'private'}
                onCheckedChange={(checked) => {
                  updateContact.mutate(
                    { id: id!, data: { visibility: checked ? 'private' : 'team' } },
                    { onSuccess: () => toast.success(checked ? 'Contact set to private' : 'Contact shared with team') }
                  );
                }}
              />
            </div>
          )}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogActivity(true)}
              className="border-green-500/50 text-green-400 hover:bg-green-500/10"
            >
              <ClipboardList className="h-4 w-4 mr-1" /> Log Activity
            </Button>
          )}
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
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAssign(true)}
              className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
            >
              <UserPlus className="h-4 w-4 mr-1" />
              {contact.assigned_rep_id ? 'Reassign' : 'Assign Rep'}
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={openDNCDialog}
                className={isDNC ? 'border-red-500/50 text-red-400 hover:bg-red-500/10' : 'border-muted-gray/50 text-muted-gray hover:bg-red-500/10 hover:text-red-400'}
              >
                <PhoneOff className="h-4 w-4 mr-1" /> DNC
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowLink(true)}>
                <Link2 className="h-4 w-4 mr-1" /> Link Profile
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
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
            {contact.phone_secondary && (
              <div className="flex items-center gap-2 text-bone-white/80">
                <Phone className="h-4 w-4 text-muted-gray" />
                <a href={`tel:${contact.phone_secondary}`} className="hover:text-accent-yellow">{contact.phone_secondary}</a>
                <span className="text-xs text-muted-gray">(secondary)</span>
              </div>
            )}
            {contact.website && (
              <div className="flex items-center gap-2 text-bone-white/80">
                <Globe className="h-4 w-4 text-muted-gray" />
                <a
                  href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-yellow truncate"
                >
                  {contact.website}
                </a>
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
            {isDNC && (
              <div className="mt-3 p-2 rounded bg-red-500/10 border border-red-500/20">
                <div className="text-xs text-red-400 font-medium mb-1">Do Not Contact Flags</div>
                <div className="flex flex-wrap gap-2 text-xs text-red-300">
                  {contact.do_not_email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> No Email</span>}
                  {contact.do_not_call && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> No Call</span>}
                  {contact.do_not_text && <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> No Text</span>}
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
                {contact.assigned_rep_name && (
                  <span className="text-xs text-muted-gray">
                    Assigned to: <span className="text-bone-white">{contact.assigned_rep_name}</span>
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ContactNotes contactId={id!} currentProfileId={currentProfile?.id || ''} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted-gray/10">
            <TabsTrigger value="timeline">Activity Timeline</TabsTrigger>
            <TabsTrigger value="emails">Emails</TabsTrigger>
            <TabsTrigger value="sequences">Sequences</TabsTrigger>
            {isAdmin && <TabsTrigger value="assignments">Assignment History</TabsTrigger>}
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

        {isAdmin && (
          <TabsContent value="assignments" className="mt-4">
            <Card className="bg-charcoal-black border-muted-gray/30">
              <CardHeader>
                <CardTitle className="text-bone-white text-base">Assignment History</CardTitle>
              </CardHeader>
              <CardContent>
                <AssignmentHistoryTimeline contactId={id!} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
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

      {/* Log Activity Dialog */}
      <CalendarActivityDialog
        open={showLogActivity}
        onOpenChange={setShowLogActivity}
        contacts={[contact]}
        onSubmit={handleLogActivity}
        isSubmitting={createActivity.isPending}
        defaultDate={new Date().toISOString().split('T')[0]}
      />

      {/* Assign Contact Dialog (admin) */}
      <ContactAssignmentDialog
        open={showAssign}
        onOpenChange={setShowAssign}
        contact={contact}
      />

      {/* DNC Dialog */}
      <Dialog open={showDNC} onOpenChange={setShowDNC}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-sm">
          <DialogHeader>
            <DialogTitle>
              DNC — {contact.first_name}{contact.last_name ? ` ${contact.last_name}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Do Not Email
              </Label>
              <Switch
                checked={dncForm.do_not_email}
                onCheckedChange={(v) => setDncForm({ ...dncForm, do_not_email: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Do Not Call
              </Label>
              <Switch
                checked={dncForm.do_not_call}
                onCheckedChange={(v) => setDncForm({ ...dncForm, do_not_call: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Do Not Text
              </Label>
              <Switch
                checked={dncForm.do_not_text}
                onCheckedChange={(v) => setDncForm({ ...dncForm, do_not_text: v })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowDNC(false)}>Cancel</Button>
              <Button
                onClick={saveDNC}
                disabled={updateDNC.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {updateDNC.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContactDetail;
