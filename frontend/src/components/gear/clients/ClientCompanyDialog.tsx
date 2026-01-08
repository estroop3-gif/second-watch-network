/**
 * Client Company Dialog
 * Create and edit client companies with documents
 */
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  FileText,
  Upload,
  X,
  Check,
  Loader2,
  Calendar,
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';

import { useGearClientCompanies } from '@/hooks/gear';
import type { GearClientCompany } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { DocumentUploader } from './DocumentUploader';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  website: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
  insurance_expiry: z.string().optional(),
  coi_expiry: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface ClientCompanyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  company: GearClientCompany | null;
  onCreated?: (companyId: string) => void;
}

export function ClientCompanyDialog({
  isOpen,
  onClose,
  orgId,
  company,
  onCreated,
}: ClientCompanyDialogProps) {
  const { createCompany, updateCompany, getUploadUrl, refetch } =
    useGearClientCompanies(orgId);
  const isEditing = !!company;

  // Document states
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [coiFile, setCoiFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      website: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'US',
      notes: '',
      insurance_expiry: '',
      coi_expiry: '',
    },
  });

  // Reset form when dialog opens/closes or company changes
  useEffect(() => {
    if (isOpen) {
      if (company) {
        form.reset({
          name: company.name,
          email: company.email || '',
          phone: company.phone || '',
          website: company.website || '',
          address_line1: company.address_line1 || '',
          address_line2: company.address_line2 || '',
          city: company.city || '',
          state: company.state || '',
          postal_code: company.postal_code || '',
          country: company.country || 'US',
          notes: company.notes || '',
          insurance_expiry: company.insurance_expiry || '',
          coi_expiry: company.coi_expiry || '',
        });
      } else {
        form.reset({
          name: '',
          email: '',
          phone: '',
          website: '',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country: 'US',
          notes: '',
          insurance_expiry: '',
          coi_expiry: '',
        });
      }
      setInsuranceFile(null);
      setCoiFile(null);
    }
  }, [isOpen, company, form]);

  const uploadFile = async (
    companyId: string,
    file: File,
    docType: 'insurance' | 'coi'
  ) => {
    const result = await getUploadUrl.mutateAsync({
      companyId,
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

  const onSubmit = async (data: CompanyFormData) => {
    try {
      setIsUploading(true);

      let createdCompanyId = company?.id;

      // Create or update the company first
      if (isEditing && company) {
        await updateCompany.mutateAsync({
          companyId: company.id,
          ...data,
          email: data.email || undefined,
        });
      } else {
        const result = await createCompany.mutateAsync({
          ...data,
          email: data.email || undefined,
        });
        createdCompanyId = result.company.id;
      }

      // Upload documents if any
      if (createdCompanyId) {
        if (insuranceFile) {
          await uploadFile(createdCompanyId, insuranceFile, 'insurance');
        }
        if (coiFile) {
          await uploadFile(createdCompanyId, coiFile, 'coi');
        }
      }

      refetch();

      // Call onCreated callback if provided (for inline company creation)
      if (!isEditing && createdCompanyId && onCreated) {
        onCreated(createdCompanyId);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error saving company:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitting = form.formState.isSubmitting || isUploading;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {isEditing ? 'Edit Company' : 'Add Client Company'}
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

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Productions" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                            placeholder="contact@company.com"
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

              <FormField
                control={form.control}
                name="website"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                        <Input
                          className="pl-9"
                          placeholder="https://company.com"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                      <Input placeholder="Suite 100" {...field} />
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

            {/* Documents */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-gray uppercase tracking-wide">
                Documents
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Insurance Certificate</Label>
                  <DocumentUploader
                    accept=".pdf,.jpg,.jpeg,.png"
                    existingFileUrl={company?.insurance_file_url}
                    existingFileName={company?.insurance_file_name}
                    onFileSelect={setInsuranceFile}
                    selectedFile={insuranceFile}
                  />
                  <FormField
                    control={form.control}
                    name="insurance_expiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Expiry Date</FormLabel>
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

                <div className="space-y-2">
                  <Label>Certificate of Insurance (COI)</Label>
                  <DocumentUploader
                    accept=".pdf,.jpg,.jpeg,.png"
                    existingFileUrl={company?.coi_file_url}
                    existingFileName={company?.coi_file_name}
                    onFileSelect={setCoiFile}
                    selectedFile={coiFile}
                  />
                  <FormField
                    control={form.control}
                    name="coi_expiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Expiry Date</FormLabel>
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
                      placeholder="Additional notes about this company..."
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
                    {isEditing ? 'Save Changes' : 'Create Company'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
