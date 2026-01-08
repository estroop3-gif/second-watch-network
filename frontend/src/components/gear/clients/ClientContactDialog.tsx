/**
 * Client Contact Dialog
 * Full form for creating/editing client contacts with documents and platform linking
 */
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  FileText,
  Camera,
  Link2,
  Search,
  Check,
  Loader2,
  Calendar,
  X,
  Building2,
  FolderOpen,
  Plus,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  useGearClientContacts,
  useGearClientCompanies,
  useGearUserSearch,
  useGearContactProjects,
} from '@/hooks/gear';
import type { GearClientContact, GearClientCompany, IDType, UserSearchResult, LinkedProject } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DocumentUploader } from './DocumentUploader';
import { ClientCompanyDialog } from './ClientCompanyDialog';

const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  client_company_id: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  id_type: z.string().optional(),
  id_expiry: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ClientContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  contact: GearClientContact | null;
  preselectedCompanyId: string | null;
}

export function ClientContactDialog({
  isOpen,
  onClose,
  orgId,
  contact,
  preselectedCompanyId,
}: ClientContactDialogProps) {
  const { createContact, updateContact, getUploadUrl, linkUser, unlinkUser, refetch } =
    useGearClientContacts(orgId);
  const { companies, refetch: refetchCompanies } = useGearClientCompanies(orgId);
  const isEditing = !!contact;

  // Document states
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Add company dialog state
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);

  // User linking states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedLinkedUser, setSelectedLinkedUser] = useState<UserSearchResult | null>(null);
  const { data: searchResults, isLoading: searchLoading } = useGearUserSearch(
    orgId,
    userSearchQuery.length >= 2 ? userSearchQuery : null
  );

  // Projects for linked user
  const { data: linkedProjects } = useGearContactProjects(
    orgId,
    contact?.id && contact?.linked_user_id ? contact.id : null
  );

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      job_title: '',
      client_company_id: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
      notes: '',
      id_type: '',
      id_expiry: '',
    },
  });

  // Reset form when dialog opens/closes or contact changes
  useEffect(() => {
    if (isOpen) {
      if (contact) {
        form.reset({
          first_name: contact.first_name,
          last_name: contact.last_name,
          email: contact.email || '',
          phone: contact.phone || '',
          job_title: contact.job_title || '',
          client_company_id: contact.client_company_id || '',
          address_line1: contact.address_line1 || '',
          address_line2: contact.address_line2 || '',
          city: contact.city || '',
          state: contact.state || '',
          postal_code: contact.postal_code || '',
          country: contact.country || 'US',
          notes: contact.notes || '',
          id_type: contact.id_type || '',
          id_expiry: contact.id_expiry || '',
        });
        // If contact has linked user, set it
        if (contact.linked_user_id) {
          setSelectedLinkedUser({
            id: contact.linked_user_id,
            display_name: contact.linked_user_name || '',
            email: contact.linked_user_email,
          });
        }
      } else {
        form.reset({
          first_name: '',
          last_name: '',
          email: '',
          phone: '',
          job_title: '',
          client_company_id: preselectedCompanyId || '',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          notes: '',
          id_type: '',
          id_expiry: '',
        });
        setSelectedLinkedUser(null);
      }
      setIdPhotoFile(null);
      setUserSearchQuery('');
    }
  }, [isOpen, contact, preselectedCompanyId, form]);

  const uploadFile = async (
    contactId: string,
    file: File,
    docType: 'id_photo' | 'personal_insurance'
  ) => {
    const result = await getUploadUrl.mutateAsync({
      contactId,
      docType,
      fileName: file.name,
    });

    // Upload to S3
    await fetch(result.upload_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });

    return result.file_url;
  };

  const onSubmit = async (data: ContactFormData) => {
    try {
      setIsUploading(true);

      let savedContactId = contact?.id;

      // Prepare the contact data
      const contactData = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        job_title: data.job_title || undefined,
        client_company_id: data.client_company_id || undefined,
        address_line1: data.address_line1 || undefined,
        address_line2: data.address_line2 || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        postal_code: data.postal_code || undefined,
        country: data.country || undefined,
        notes: data.notes || undefined,
        id_type: (data.id_type as IDType) || undefined,
        id_expiry: data.id_expiry || undefined,
      };

      // Create or update the contact first
      if (isEditing && contact) {
        await updateContact.mutateAsync({
          contactId: contact.id,
          ...contactData,
        });
      } else {
        const result = await createContact.mutateAsync(contactData);
        savedContactId = result.contact.id;
      }

      // Upload ID photo if provided
      if (savedContactId && idPhotoFile) {
        await uploadFile(savedContactId, idPhotoFile, 'id_photo');
      }

      // Handle user linking
      if (savedContactId) {
        const currentLinkedUserId = contact?.linked_user_id;
        const newLinkedUserId = selectedLinkedUser?.id;

        if (newLinkedUserId && newLinkedUserId !== currentLinkedUserId) {
          await linkUser.mutateAsync({ contactId: savedContactId, userId: newLinkedUserId });
        } else if (!newLinkedUserId && currentLinkedUserId) {
          await unlinkUser.mutateAsync(savedContactId);
        }
      }

      refetch();
      onClose();
    } catch (error) {
      console.error('Error saving contact:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectLinkedUser = (user: UserSearchResult) => {
    setSelectedLinkedUser(user);
    setUserSearchQuery('');
  };

  const handleUnlinkUser = () => {
    setSelectedLinkedUser(null);
  };

  const isSubmitting = form.formState.isSubmitting || isUploading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {isEditing ? 'Edit Contact' : 'Add Client Contact'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input
                            className="pl-9"
                            placeholder="john@company.com"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input className="pl-9" placeholder="(555) 123-4567" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="job_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input className="pl-9" placeholder="Producer" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="client_company_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company</FormLabel>
                      <Select
                        onValueChange={(v) => {
                          if (v === '_add_new') {
                            setIsAddCompanyOpen(true);
                          } else {
                            field.onChange(v === '_none' ? '' : v);
                          }
                        }}
                        value={field.value || '_none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-muted-gray" />
                              <SelectValue placeholder="Select company (optional)" />
                            </div>
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">No Company (Individual)</SelectItem>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                          <SelectItem value="_add_new" className="text-accent-yellow">
                            <div className="flex items-center gap-2">
                              <Plus className="w-4 h-4" />
                              Add New Company
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Platform Link */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                Platform Link
              </h3>

              {selectedLinkedUser ? (
                <div className="p-4 rounded-lg border border-green-500/30 bg-green-500/10">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-bone-white">
                          {selectedLinkedUser.display_name}
                        </p>
                        {selectedLinkedUser.email && (
                          <p className="text-sm text-muted-gray">{selectedLinkedUser.email}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleUnlinkUser}
                    >
                      <X className="w-4 h-4 mr-1" />
                      Unlink
                    </Button>
                  </div>

                  {/* Show linked user's projects if editing */}
                  {linkedProjects && linkedProjects.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-500/30">
                      <p className="text-xs text-muted-gray mb-2 flex items-center gap-1">
                        <FolderOpen className="w-3 h-3" />
                        Active Projects
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {linkedProjects.map((project) => (
                          <Badge
                            key={project.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {project.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                    <Input
                      className="pl-9"
                      placeholder="Search by email or name to link platform account..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchLoading && (
                    <div className="flex items-center gap-2 text-sm text-muted-gray p-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching...
                    </div>
                  )}

                  {searchResults && searchResults.length > 0 && (
                    <div className="border border-muted-gray/30 rounded-lg overflow-hidden">
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-charcoal-black/50 transition-colors border-b border-muted-gray/30 last:border-b-0"
                          onClick={() => handleSelectLinkedUser(user)}
                        >
                          <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-blue-400" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-bone-white">
                              {user.display_name}
                            </p>
                            {user.email && (
                              <p className="text-xs text-muted-gray">{user.email}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults && searchResults.length === 0 && userSearchQuery.length >= 2 && (
                    <p className="text-sm text-muted-gray p-2">No users found</p>
                  )}

                  <p className="text-xs text-muted-gray">
                    Link to a platform account to view their active projects during checkout
                  </p>
                </div>
              )}
            </div>

            {/* ID Document */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                ID Document
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="id_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Type</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === '_none' ? '' : v)}
                        value={field.value || '_none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Not specified</SelectItem>
                          <SelectItem value="drivers_license">Driver's License</SelectItem>
                          <SelectItem value="passport">Passport</SelectItem>
                          <SelectItem value="state_id">State ID</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="id_expiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID Expiry Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input type="date" className="pl-9" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div>
                <Label className="mb-2 block">ID Photo</Label>
                <DocumentUploader
                  accept=".jpg,.jpeg,.png,.pdf"
                  existingFileUrl={contact?.id_photo_url}
                  existingFileName={contact?.id_photo_file_name}
                  onFileSelect={setIdPhotoFile}
                  selectedFile={idPhotoFile}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                Address
              </h3>

              <FormField
                control={form.control}
                name="address_line1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 1</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                        <Input className="pl-9" placeholder="123 Main Street" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address_line2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address Line 2</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt 4B" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Los Angeles" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State</FormLabel>
                      <FormControl>
                        <Input placeholder="CA" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="90001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country</FormLabel>
                      <FormControl>
                        <Input placeholder="US" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Additional notes about this contact..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </div>

            <DialogFooter className="flex-shrink-0 pt-4 border-t border-muted-gray/30 mt-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isUploading ? 'Uploading...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    {isEditing ? 'Save Changes' : 'Create Contact'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Add Company Dialog */}
      <ClientCompanyDialog
        isOpen={isAddCompanyOpen}
        onClose={() => setIsAddCompanyOpen(false)}
        orgId={orgId}
        company={null}
        onCreated={(newCompanyId) => {
          // Select the newly created company
          form.setValue('client_company_id', newCompanyId);
          refetchCompanies();
          setIsAddCompanyOpen(false);
        }}
      />
    </Dialog>
  );
}
