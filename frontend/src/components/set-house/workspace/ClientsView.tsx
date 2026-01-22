/**
 * Clients View
 * Manage client companies and contacts for Set House
 */
import React, { useState } from 'react';
import {
  Building2,
  User,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Phone,
  Mail,
  Loader2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSetHouseClientCompanies, useSetHouseClientContacts } from '@/hooks/set-house';
import type { SetHouseClientCompany, SetHouseClientContact } from '@/types/set-house';
import { cn } from '@/lib/utils';

interface ClientsViewProps {
  orgId: string;
  orgType?: string;
}

export function ClientsView({ orgId, orgType }: ClientsViewProps) {
  const [activeTab, setActiveTab] = useState<'companies' | 'contacts'>('companies');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateCompanyOpen, setIsCreateCompanyOpen] = useState(false);
  const [isCreateContactOpen, setIsCreateContactOpen] = useState(false);

  const { companies, isLoading: companiesLoading, createCompany } = useSetHouseClientCompanies(orgId);
  const { contacts, isLoading: contactsLoading, createContact } = useSetHouseClientContacts(orgId);

  const filteredCompanies = (companies ?? []).filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredContacts = (contacts ?? []).filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            activeTab === 'companies' ? setIsCreateCompanyOpen(true) : setIsCreateContactOpen(true)
          }
        >
          <Plus className="w-4 h-4 mr-2" />
          {activeTab === 'companies' ? 'Add Company' : 'Add Contact'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'companies' | 'contacts')}>
        <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
          <TabsTrigger value="companies">
            <Building2 className="w-4 h-4 mr-2" />
            Companies ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="contacts">
            <User className="w-4 h-4 mr-2" />
            Contacts ({contacts.length})
          </TabsTrigger>
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies" className="mt-6">
          {companiesLoading ? (
            <TableSkeleton />
          ) : filteredCompanies.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-12 h-12" />}
              title="No Client Companies"
              description="Add client companies to track your business relationships"
              action={
                <Button onClick={() => setIsCreateCompanyOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Company
                </Button>
              }
            />
          ) : (
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30 hover:bg-transparent">
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow
                      key={company.id}
                      className="border-muted-gray/30 hover:bg-charcoal-black/30"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="font-medium text-bone-white">{company.name}</p>
                            {company.email && (
                              <p className="text-xs text-muted-gray">{company.email}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.primary_contact_name || <span className="text-muted-gray">—</span>}
                      </TableCell>
                      <TableCell>
                        {company.phone || <span className="text-muted-gray">—</span>}
                      </TableCell>
                      <TableCell>
                        {company.company_type && (
                          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                            {company.company_type}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-400">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="mt-6">
          {contactsLoading ? (
            <TableSkeleton />
          ) : filteredContacts.length === 0 ? (
            <EmptyState
              icon={<User className="w-12 h-12" />}
              title="No Client Contacts"
              description="Add contacts to keep track of your client relationships"
              action={
                <Button onClick={() => setIsCreateContactOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              }
            />
          ) : (
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30 hover:bg-transparent">
                    <TableHead>Name</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="border-muted-gray/30 hover:bg-charcoal-black/30"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                            <User className="w-5 h-5 text-purple-400" />
                          </div>
                          <p className="font-medium text-bone-white">{contact.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.company_name || <span className="text-muted-gray">—</span>}
                      </TableCell>
                      <TableCell>
                        {contact.email ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="w-3 h-3 text-muted-gray" />
                            {contact.email}
                          </div>
                        ) : (
                          <span className="text-muted-gray">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.phone ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="w-3 h-3 text-muted-gray" />
                            {contact.phone}
                          </div>
                        ) : (
                          <span className="text-muted-gray">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-400">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Company Modal */}
      <CreateCompanyModal
        isOpen={isCreateCompanyOpen}
        onClose={() => setIsCreateCompanyOpen(false)}
        onSubmit={async (data) => {
          await createCompany.mutateAsync(data);
          setIsCreateCompanyOpen(false);
        }}
        isSubmitting={createCompany.isPending}
      />

      {/* Create Contact Modal */}
      <CreateContactModal
        isOpen={isCreateContactOpen}
        onClose={() => setIsCreateContactOpen(false)}
        companies={companies}
        onSubmit={async (data) => {
          await createContact.mutateAsync(data);
          setIsCreateContactOpen(false);
        }}
        isSubmitting={createContact.isPending}
      />
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-muted-gray mb-4">{icon}</div>
        <h3 className="text-lg font-medium text-bone-white mb-2">{title}</h3>
        <p className="text-muted-gray text-center max-w-md mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE COMPANY MODAL
// ============================================================================

function CreateCompanyModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; email?: string; phone?: string; company_type?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyType, setCompanyType] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Company name is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company_type: companyType.trim() || undefined,
      });
      setName('');
      setEmail('');
      setPhone('');
      setCompanyType('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create company');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Client Company</DialogTitle>
          <DialogDescription>Add a new client company to your organization</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="company-name">Company Name *</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Productions"
            />
          </div>
          <div>
            <Label htmlFor="company-email">Email</Label>
            <Input
              id="company-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@acme.com"
            />
          </div>
          <div>
            <Label htmlFor="company-phone">Phone</Label>
            <Input
              id="company-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <Label htmlFor="company-type">Company Type</Label>
            <Input
              id="company-type"
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value)}
              placeholder="Production Company"
            />
          </div>
          {error && <div className="text-sm text-primary-red">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// CREATE CONTACT MODAL
// ============================================================================

function CreateContactModal({
  isOpen,
  onClose,
  companies,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  companies: SetHouseClientCompany[];
  onSubmit: (data: { name: string; email?: string; phone?: string; company_id?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Contact name is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        company_id: companyId || undefined,
      });
      setName('');
      setEmail('');
      setPhone('');
      setCompanyId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create contact');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Client Contact</DialogTitle>
          <DialogDescription>Add a new contact person</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="contact-name">Name *</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
            />
          </div>
          {companies.length > 0 && (
            <div>
              <Label htmlFor="contact-company">Company</Label>
              <select
                id="contact-company"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@acme.com"
            />
          </div>
          <div>
            <Label htmlFor="contact-phone">Phone</Label>
            <Input
              id="contact-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          {error && <div className="text-sm text-primary-red">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
