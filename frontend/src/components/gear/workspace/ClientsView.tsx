/**
 * Clients View
 * Manage client companies and contacts for gear rentals
 */
import React, { useState, useMemo } from 'react';
import {
  Building2,
  User,
  Plus,
  Search,
  Mail,
  Phone,
  Globe,
  FileCheck,
  AlertCircle,
  Link2,
  Camera,
  ChevronDown,
  ChevronRight,
  Pencil,
  Users,
  Shield,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  useGearClientCompanies,
  useGearClientContacts,
} from '@/hooks/gear';
import type { GearClientCompany, GearClientContact, OrganizationType } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format, isPast, isAfter, addDays } from 'date-fns';
import { ClientCompanyDialog } from '@/components/gear/clients/ClientCompanyDialog';
import { ClientContactDialog } from '@/components/gear/clients/ClientContactDialog';

interface ClientsViewProps {
  orgId: string;
  orgType?: OrganizationType;
}

export function ClientsView({ orgId }: ClientsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState<string>('all');
  const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());

  // Dialogs
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<GearClientCompany | null>(null);
  const [editingContact, setEditingContact] = useState<GearClientContact | null>(null);
  const [preselectedCompanyId, setPreselectedCompanyId] = useState<string | null>(null);

  const { companies, isLoading: companiesLoading } = useGearClientCompanies(orgId);
  const { contacts, isLoading: contactsLoading } = useGearClientContacts(orgId);

  const isLoading = companiesLoading || contactsLoading;

  // Filter and group contacts
  const filteredData = useMemo(() => {
    let filteredContacts = contacts;
    let filteredCompanies = companies;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredContacts = contacts.filter(
        (c) =>
          c.first_name.toLowerCase().includes(query) ||
          c.last_name.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query) ||
          c.job_title?.toLowerCase().includes(query)
      );
      filteredCompanies = companies.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
      );
    }

    // Company filter
    if (companyFilter !== 'all') {
      if (companyFilter === 'individual') {
        filteredContacts = filteredContacts.filter((c) => !c.client_company_id);
        filteredCompanies = [];
      } else {
        filteredContacts = filteredContacts.filter(
          (c) => c.client_company_id === companyFilter
        );
        filteredCompanies = filteredCompanies.filter((c) => c.id === companyFilter);
      }
    }

    // Group contacts by company
    const contactsByCompany = new Map<string, GearClientContact[]>();
    const individualContacts: GearClientContact[] = [];

    filteredContacts.forEach((contact) => {
      if (contact.client_company_id) {
        const existing = contactsByCompany.get(contact.client_company_id) || [];
        contactsByCompany.set(contact.client_company_id, [...existing, contact]);
      } else {
        individualContacts.push(contact);
      }
    });

    return { filteredCompanies, contactsByCompany, individualContacts };
  }, [contacts, companies, searchQuery, companyFilter]);

  const toggleCompanyExpanded = (companyId: string) => {
    const newExpanded = new Set(expandedCompanies);
    if (newExpanded.has(companyId)) {
      newExpanded.delete(companyId);
    } else {
      newExpanded.add(companyId);
    }
    setExpandedCompanies(newExpanded);
  };

  const handleAddContact = (companyId?: string) => {
    setEditingContact(null);
    setPreselectedCompanyId(companyId || null);
    setIsContactDialogOpen(true);
  };

  const handleEditCompany = (company: GearClientCompany) => {
    setEditingCompany(company);
    setIsCompanyDialogOpen(true);
  };

  const handleEditContact = (contact: GearClientContact) => {
    setEditingContact(contact);
    setPreselectedCompanyId(contact.client_company_id || null);
    setIsContactDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              <SelectItem value="individual">Individual Only</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setEditingCompany(null);
              setIsCompanyDialogOpen(true);
            }}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Add Company
          </Button>
          <Button onClick={() => handleAddContact()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <ClientsLoadingSkeleton />
      ) : filteredData.filteredCompanies.length === 0 &&
        filteredData.individualContacts.length === 0 ? (
        <EmptyState
          onAddCompany={() => {
            setEditingCompany(null);
            setIsCompanyDialogOpen(true);
          }}
          onAddContact={() => handleAddContact()}
        />
      ) : (
        <div className="space-y-4">
          {/* Companies with contacts */}
          {filteredData.filteredCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              contacts={filteredData.contactsByCompany.get(company.id) || []}
              isExpanded={expandedCompanies.has(company.id)}
              onToggleExpand={() => toggleCompanyExpanded(company.id)}
              onEditCompany={() => handleEditCompany(company)}
              onAddContact={() => handleAddContact(company.id)}
              onEditContact={handleEditContact}
            />
          ))}

          {/* Individual contacts (no company) */}
          {filteredData.individualContacts.length > 0 && (
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-muted-gray" />
                  Individual Clients
                  <Badge variant="secondary" className="ml-2">
                    {filteredData.individualContacts.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredData.individualContacts.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEdit={() => handleEditContact(contact)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ClientCompanyDialog
        isOpen={isCompanyDialogOpen}
        onClose={() => {
          setIsCompanyDialogOpen(false);
          setEditingCompany(null);
        }}
        orgId={orgId}
        company={editingCompany}
      />

      <ClientContactDialog
        isOpen={isContactDialogOpen}
        onClose={() => {
          setIsContactDialogOpen(false);
          setEditingContact(null);
          setPreselectedCompanyId(null);
        }}
        orgId={orgId}
        contact={editingContact}
        preselectedCompanyId={preselectedCompanyId}
      />
    </div>
  );
}

// Company Card Component
interface CompanyCardProps {
  company: GearClientCompany;
  contacts: GearClientContact[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEditCompany: () => void;
  onAddContact: () => void;
  onEditContact: (contact: GearClientContact) => void;
}

function CompanyCard({
  company,
  contacts,
  isExpanded,
  onToggleExpand,
  onEditCompany,
  onAddContact,
  onEditContact,
}: CompanyCardProps) {
  const insuranceStatus = getDocumentStatus(company.insurance_expiry);
  const coiStatus = getDocumentStatus(company.coi_expiry);

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-charcoal-black/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {company.name}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-muted-gray" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-gray" />
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-4 text-sm text-muted-gray mt-1">
                    {company.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {company.email}
                      </span>
                    )}
                    {company.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {company.phone}
                      </span>
                    )}
                    {company.website && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        {company.website}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Document Status Badges */}
                <div className="flex gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <DocumentStatusBadge
                          label="Insurance"
                          status={insuranceStatus}
                          hasFile={!!company.insurance_file_url}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {company.insurance_file_url
                          ? company.insurance_expiry
                            ? `Expires: ${format(new Date(company.insurance_expiry), 'MMM d, yyyy')}`
                            : 'Insurance on file (no expiry set)'
                          : 'No insurance on file'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <DocumentStatusBadge
                          label="COI"
                          status={coiStatus}
                          hasFile={!!company.coi_file_url}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {company.coi_file_url
                          ? company.coi_expiry
                            ? `Expires: ${format(new Date(company.coi_expiry), 'MMM d, yyyy')}`
                            : 'COI on file (no expiry set)'
                          : 'No COI on file'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Badge variant="secondary">
                  {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                </Badge>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCompany();
                  }}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="border-t border-muted-gray/30 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-muted-gray">CONTACTS</span>
                <Button variant="ghost" size="sm" onClick={onAddContact}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Contact
                </Button>
              </div>

              {contacts.length === 0 ? (
                <p className="text-sm text-muted-gray text-center py-4">
                  No contacts for this company yet
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {contacts.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onEdit={() => onEditContact(contact)}
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// Contact Card Component
interface ContactCardProps {
  contact: GearClientContact;
  onEdit: () => void;
}

function ContactCard({ contact, onEdit }: ContactCardProps) {
  const idStatus = getDocumentStatus(contact.id_expiry);
  const hasIdOnFile = !!contact.id_photo_url;
  const isLinked = !!contact.linked_user_id;

  return (
    <div
      className={cn(
        'p-3 rounded-lg border border-muted-gray/30 bg-charcoal-black/30',
        'hover:border-muted-gray/50 transition-colors cursor-pointer'
      )}
      onClick={onEdit}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center">
            <User className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <p className="font-medium text-bone-white">
              {contact.first_name} {contact.last_name}
            </p>
            {contact.job_title && (
              <p className="text-xs text-muted-gray">{contact.job_title}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {isLinked && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <Link2 className="w-3 h-3" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Linked to: {contact.linked_user_name || contact.linked_user_email}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {hasIdOnFile && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    className={cn(
                      'border',
                      idStatus === 'valid'
                        ? 'bg-green-500/20 text-green-400 border-green-500/30'
                        : idStatus === 'expiring'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : idStatus === 'expired'
                            ? 'bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    )}
                  >
                    <Camera className="w-3 h-3" />
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  {contact.id_type
                    ? `${formatIdType(contact.id_type)} on file`
                    : 'ID on file'}
                  {contact.id_expiry &&
                    ` - Expires: ${format(new Date(contact.id_expiry), 'MMM d, yyyy')}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-gray">
        {contact.email && (
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {contact.email}
          </span>
        )}
        {contact.phone && (
          <span className="flex items-center gap-1">
            <Phone className="w-3 h-3" />
            {contact.phone}
          </span>
        )}
      </div>
    </div>
  );
}

// Document Status Badge
function DocumentStatusBadge({
  label,
  status,
  hasFile,
}: {
  label: string;
  status: 'valid' | 'expiring' | 'expired' | 'none';
  hasFile: boolean;
}) {
  if (!hasFile) {
    return (
      <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 border text-xs">
        <FileCheck className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  }

  const statusConfig = {
    valid: {
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: <Shield className="w-3 h-3 mr-1" />,
    },
    expiring: {
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      icon: <AlertCircle className="w-3 h-3 mr-1" />,
    },
    expired: {
      className: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: <AlertCircle className="w-3 h-3 mr-1" />,
    },
    none: {
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: <FileCheck className="w-3 h-3 mr-1" />,
    },
  };

  const config = statusConfig[status];

  return (
    <Badge className={cn('border text-xs', config.className)}>
      {config.icon}
      {label}
    </Badge>
  );
}

// Helper functions
function getDocumentStatus(
  expiryDate?: string | null
): 'valid' | 'expiring' | 'expired' | 'none' {
  if (!expiryDate) return 'none';

  const expiry = new Date(expiryDate);
  const today = new Date();
  const warningDate = addDays(today, 30);

  if (isPast(expiry)) return 'expired';
  if (isAfter(warningDate, expiry)) return 'expiring';
  return 'valid';
}

function formatIdType(idType: string): string {
  const labels: Record<string, string> = {
    drivers_license: "Driver's License",
    passport: 'Passport',
    state_id: 'State ID',
    other: 'ID',
  };
  return labels[idType] || 'ID';
}

// Empty State
function EmptyState({
  onAddCompany,
  onAddContact,
}: {
  onAddCompany: () => void;
  onAddContact: () => void;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Users className="w-12 h-12 text-muted-gray mb-4" />
        <h3 className="text-lg font-medium text-bone-white mb-2">No Clients Yet</h3>
        <p className="text-muted-gray text-center mb-6 max-w-md">
          Add client companies and contacts to track your rental customers, their
          documents, and link them to their platform accounts.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onAddCompany}>
            <Building2 className="w-4 h-4 mr-2" />
            Add Company
          </Button>
          <Button onClick={onAddContact}>
            <Plus className="w-4 h-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading Skeleton
function ClientsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
