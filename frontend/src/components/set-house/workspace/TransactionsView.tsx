/**
 * Transactions View - 6-Tab Structure
 * For Set House booking/rental transactions
 *
 * Tabs:
 * - Outgoing: Our spaces currently booked out to others
 * - Incoming: Spaces we're renting from other organizations
 * - Requests: Pending quotes, approvals, and extensions
 * - History: Completed transactions
 * - Overdue: Late returns requiring attention
 * - Work Orders: Pre-booking staging
 */
import React, { useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  MessageSquare,
  History,
  AlertTriangle,
  Plus,
  Clock,
  CheckCircle2,
  Home,
  User,
  Building2,
  Calendar,
  DollarSign,
  ClipboardList,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, X, Package, Search, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import {
  useSetHouseTransactions,
  useSetHouseSpaces,
  useSetHouseClientCompanies,
  useSetHouseClientContacts,
  useSetHousePackageInstances,
} from '@/hooks/set-house';
import type {
  SetHouseTransaction,
  SetHouseSpace,
  SetHouseClientCompany,
  SetHouseClientContact,
  SetHousePackageInstance,
  CreateTransactionInput,
} from '@/types/set-house';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

type TransactionTab = 'outgoing' | 'incoming' | 'requests' | 'history' | 'overdue' | 'work_orders';

const TABS: Array<{
  id: TransactionTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: 'outgoing',
    label: 'Outgoing',
    icon: <ArrowUpRight className="w-4 h-4" />,
    description: 'Our spaces booked out',
  },
  {
    id: 'incoming',
    label: 'Incoming',
    icon: <ArrowDownLeft className="w-4 h-4" />,
    description: "Spaces we're renting",
  },
  {
    id: 'requests',
    label: 'Requests',
    icon: <MessageSquare className="w-4 h-4" />,
    description: 'Pending approvals',
  },
  {
    id: 'history',
    label: 'History',
    icon: <History className="w-4 h-4" />,
    description: 'Completed bookings',
  },
  {
    id: 'overdue',
    label: 'Overdue',
    icon: <AlertTriangle className="w-4 h-4" />,
    description: 'Late returns',
  },
  {
    id: 'work_orders',
    label: 'Work Orders',
    icon: <ClipboardList className="w-4 h-4" />,
    description: 'Pre-booking staging',
  },
];

interface TransactionsViewProps {
  orgId: string;
  orgType?: string;
}

export function TransactionsView({ orgId, orgType }: TransactionsViewProps) {
  const [activeTab, setActiveTab] = useState<TransactionTab>('outgoing');
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);

  const { transactions, isLoading, createTransaction, refetch: refetchTransactions } = useSetHouseTransactions(orgId, {
    status: activeTab === 'history' ? 'completed' : activeTab === 'overdue' ? 'overdue' : 'active',
  });
  const { spaces } = useSetHouseSpaces(orgId);
  const { companies, createCompany, refetch: refetchCompanies } = useSetHouseClientCompanies(orgId);
  const { contacts, createContact, refetch: refetchContacts } = useSetHouseClientContacts(orgId);
  const { instances: packages } = useSetHousePackageInstances(orgId);

  // Filter transactions based on tab
  const filteredTransactions = transactions.filter((tx) => {
    if (activeTab === 'outgoing') return tx.transaction_type === 'rental_out' || tx.transaction_type === 'internal_booking';
    if (activeTab === 'incoming') return tx.transaction_type === 'rental_in';
    if (activeTab === 'history') return tx.status === 'completed' || tx.status === 'returned';
    return true;
  });

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TransactionTab)}>
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30 flex-wrap h-auto">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="flex items-center gap-2 data-[state=active]:bg-accent-yellow/20"
              >
                {tab.icon}
                <span>{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex gap-2">
            <Button variant="outline">
              <ClipboardList className="w-4 h-4 mr-2" />
              New Work Order
            </Button>
            <Button onClick={() => setIsQuickBookingOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Booking
            </Button>
          </div>
        </div>

        {/* Outgoing Tab */}
        <TabsContent value="outgoing" className="mt-6">
          <TransactionTable
            transactions={filteredTransactions}
            isLoading={isLoading}
            emptyTitle="No outgoing bookings"
            emptyDescription="Spaces you book out to others will appear here"
            emptyIcon={<ArrowUpRight className="w-12 h-12" />}
          />
        </TabsContent>

        {/* Incoming Tab */}
        <TabsContent value="incoming" className="mt-6">
          <TransactionTable
            transactions={filteredTransactions}
            isLoading={isLoading}
            emptyTitle="No incoming rentals"
            emptyDescription="Spaces you rent from other organizations will appear here"
            emptyIcon={<ArrowDownLeft className="w-12 h-12" />}
          />
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-6">
          <EmptyState
            icon={<MessageSquare className="w-12 h-12" />}
            title="No pending requests"
            description="Quote requests, approvals, and extensions will appear here"
          />
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-6">
          <TransactionTable
            transactions={filteredTransactions}
            isLoading={isLoading}
            emptyTitle="No transaction history"
            emptyDescription="Completed bookings and rentals will appear here"
            emptyIcon={<History className="w-12 h-12" />}
          />
        </TabsContent>

        {/* Overdue Tab */}
        <TabsContent value="overdue" className="mt-6">
          <EmptyState
            icon={<CheckCircle2 className="w-12 h-12 text-green-400" />}
            title="No overdue bookings"
            description="All bookings are on schedule"
          />
        </TabsContent>

        {/* Work Orders Tab */}
        <TabsContent value="work_orders" className="mt-6">
          <EmptyState
            icon={<ClipboardList className="w-12 h-12" />}
            title="No work orders"
            description="Create work orders to stage pre-booking preparations"
          />
        </TabsContent>
      </Tabs>

      {/* Quick Booking Dialog */}
      <QuickBookingDialog
        isOpen={isQuickBookingOpen}
        onClose={() => setIsQuickBookingOpen(false)}
        spaces={spaces.filter(s => s.status === 'available')}
        packages={packages}
        companies={companies}
        contacts={contacts}
        onCreateCompany={async (data) => {
          const result = await createCompany.mutateAsync(data);
          refetchCompanies();
          return result.company;
        }}
        onCreateContact={async (data) => {
          const result = await createContact.mutateAsync(data);
          refetchContacts();
          return result.contact;
        }}
        onSubmit={async (data) => {
          await createTransaction.mutateAsync(data);
          setIsQuickBookingOpen(false);
          refetchTransactions();
          toast.success('Booking created successfully');
        }}
        isSubmitting={createTransaction.isPending}
      />
    </div>
  );
}

// ============================================================================
// TRANSACTION TABLE
// ============================================================================

function TransactionTable({
  transactions,
  isLoading,
  emptyTitle,
  emptyDescription,
  emptyIcon,
}: {
  transactions: SetHouseTransaction[];
  isLoading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: React.ReactNode;
}) {
  if (isLoading) {
    return <TableSkeleton />;
  }

  if (transactions.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-gray">
          {transactions.length} Transaction{transactions.length !== 1 ? 's' : ''}
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Reference</TableHead>
            <TableHead>Client / Renter</TableHead>
            <TableHead>Spaces</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => (
            <TableRow
              key={tx.id}
              className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer"
            >
              <TableCell>
                <code className="text-sm">{tx.reference_number || tx.id.slice(0, 8)}</code>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {tx.renter_org_name ? (
                    <>
                      <Building2 className="w-4 h-4 text-muted-gray" />
                      <span>{tx.renter_org_name}</span>
                    </>
                  ) : (
                    <>
                      <User className="w-4 h-4 text-muted-gray" />
                      <span>{tx.primary_custodian_name || '—'}</span>
                    </>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Home className="w-4 h-4 text-muted-gray" />
                  <span>{tx.item_count ?? 0}</span>
                </div>
              </TableCell>
              <TableCell>
                {tx.rental_start_date && tx.rental_end_date ? (
                  <div className="text-sm">
                    {format(new Date(tx.rental_start_date), 'MMM d')} - {format(new Date(tx.rental_end_date), 'MMM d, yyyy')}
                  </div>
                ) : (
                  <span className="text-muted-gray">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                  {tx.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

// ============================================================================
// SHARED COMPONENTS
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
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="text-muted-gray mb-4">{icon}</div>
        <h3 className="text-lg font-medium text-bone-white mb-2">{title}</h3>
        <p className="text-muted-gray text-center max-w-md">{description}</p>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// QUICK BOOKING DIALOG
// ============================================================================

type RateType = 'hourly' | 'half_day' | 'daily' | 'weekly' | 'monthly';
type BookingMode = 'spaces' | 'packages';

const RATE_LABELS: Record<RateType, string> = {
  hourly: 'Hourly',
  half_day: 'Half Day (4hr)',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function QuickBookingDialog({
  isOpen,
  onClose,
  spaces,
  packages,
  companies,
  contacts,
  onCreateCompany,
  onCreateContact,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  spaces: SetHouseSpace[];
  packages: SetHousePackageInstance[];
  companies: SetHouseClientCompany[];
  contacts: SetHouseClientContact[];
  onCreateCompany: (data: { name: string; email?: string; phone?: string }) => Promise<SetHouseClientCompany>;
  onCreateContact: (data: { first_name: string; last_name: string; email?: string; phone?: string; company?: string }) => Promise<SetHouseClientContact>;
  onSubmit: (data: CreateTransactionInput) => Promise<void>;
  isSubmitting: boolean;
}) {
  // Booking mode
  const [bookingMode, setBookingMode] = useState<BookingMode>('spaces');

  // Selection state
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [rateType, setRateType] = useState<RateType>('daily');

  // Client state
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientType, setNewClientType] = useState<'company' | 'contact'>('company');

  // New client form
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyPhone, setNewCompanyPhone] = useState('');
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactCompany, setNewContactCompany] = useState('');

  // Dates and notes
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isCreatingClientLoading, setIsCreatingClientLoading] = useState(false);

  // Filter clients based on search
  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );
  const filteredContacts = contacts.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(clientSearch.toLowerCase()))
  );

  // Get selected items for pricing display
  const selectedSpaces = spaces.filter(s => selectedSpaceIds.includes(s.id));
  const selectedPackage = packages.find(p => p.id === selectedPackageId);
  const selectedCompany = companies.find(c => c.id === selectedCompanyId);
  const selectedContact = contacts.find(c => c.id === selectedContactId);

  // Calculate total price
  const calculateTotal = () => {
    if (bookingMode === 'packages' && selectedPackage) {
      const rateMap: Record<RateType, number | undefined> = {
        hourly: selectedPackage.hourly_rate,
        half_day: selectedPackage.half_day_rate,
        daily: selectedPackage.daily_rate,
        weekly: selectedPackage.weekly_rate,
        monthly: selectedPackage.monthly_rate,
      };
      return rateMap[rateType] || 0;
    }

    if (bookingMode === 'spaces' && selectedSpaces.length > 0) {
      return selectedSpaces.reduce((sum, space) => {
        const rateMap: Record<RateType, number | undefined> = {
          hourly: space.hourly_rate,
          half_day: space.half_day_rate,
          daily: space.daily_rate,
          weekly: space.weekly_rate,
          monthly: space.monthly_rate,
        };
        return sum + (rateMap[rateType] || 0);
      }, 0);
    }

    return 0;
  };

  const toggleSpace = (spaceId: string) => {
    setSelectedSpaceIds(prev =>
      prev.includes(spaceId)
        ? prev.filter(id => id !== spaceId)
        : [...prev, spaceId]
    );
  };

  const handleCreateClient = async () => {
    setIsCreatingClientLoading(true);
    try {
      if (newClientType === 'company') {
        if (!newCompanyName.trim()) {
          setError('Company name is required');
          return;
        }
        const company = await onCreateCompany({
          name: newCompanyName.trim(),
          email: newCompanyEmail.trim() || undefined,
          phone: newCompanyPhone.trim() || undefined,
        });
        setSelectedCompanyId(company.id);
        setIsCreatingClient(false);
        setNewCompanyName('');
        setNewCompanyEmail('');
        setNewCompanyPhone('');
        toast.success('Client company created');
      } else {
        if (!newContactFirstName.trim() || !newContactLastName.trim()) {
          setError('First and last name are required');
          return;
        }
        const contact = await onCreateContact({
          first_name: newContactFirstName.trim(),
          last_name: newContactLastName.trim(),
          email: newContactEmail.trim() || undefined,
          phone: newContactPhone.trim() || undefined,
          company: newContactCompany.trim() || undefined,
        });
        setSelectedContactId(contact.id);
        setIsCreatingClient(false);
        setNewContactFirstName('');
        setNewContactLastName('');
        setNewContactEmail('');
        setNewContactPhone('');
        setNewContactCompany('');
        toast.success('Client contact created');
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setIsCreatingClientLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (bookingMode === 'spaces' && selectedSpaceIds.length === 0) {
      setError('Please select at least one space');
      return;
    }
    if (bookingMode === 'packages' && !selectedPackageId) {
      setError('Please select a package');
      return;
    }
    if (!startDate || !endDate) {
      setError('Please select start and end dates');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      setError('End date must be after start date');
      return;
    }

    setError(null);
    try {
      await onSubmit({
        transaction_type: 'rental_out',
        space_ids: bookingMode === 'spaces' ? selectedSpaceIds : undefined,
        package_instance_ids: bookingMode === 'packages' && selectedPackageId ? [selectedPackageId] : undefined,
        rental_start_date: startDate,
        rental_end_date: endDate,
        notes: notes.trim() || undefined,
        client_company_id: selectedCompanyId || undefined,
        client_contact_id: selectedContactId || undefined,
      });
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    }
  };

  const handleClose = () => {
    setBookingMode('spaces');
    setSelectedSpaceIds([]);
    setSelectedPackageId(null);
    setRateType('daily');
    setSelectedCompanyId(null);
    setSelectedContactId(null);
    setClientSearch('');
    setIsCreatingClient(false);
    setNewCompanyName('');
    setNewCompanyEmail('');
    setNewCompanyPhone('');
    setNewContactFirstName('');
    setNewContactLastName('');
    setNewContactEmail('');
    setNewContactPhone('');
    setNewContactCompany('');
    setStartDate('');
    setEndDate('');
    setNotes('');
    setError(null);
    onClose();
  };

  const hasSelection = bookingMode === 'spaces' ? selectedSpaceIds.length > 0 : !!selectedPackageId;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-yellow" />
            New Booking
          </DialogTitle>
          <DialogDescription>
            Book spaces or packages out to a client
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-4" style={{ maxHeight: 'calc(90vh - 220px)' }}>
            <div className="space-y-6 pb-4">
              {/* Booking Mode Toggle */}
              <div>
                <Label className="text-sm font-medium mb-3 block">What are you booking?</Label>
                <div className="flex rounded-lg border border-muted-gray/30 p-1 bg-charcoal-black/30">
                  <button
                    type="button"
                    onClick={() => { setBookingMode('spaces'); setSelectedPackageId(null); }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors',
                      bookingMode === 'spaces'
                        ? 'bg-accent-yellow text-charcoal-black'
                        : 'text-muted-gray hover:text-bone-white'
                    )}
                  >
                    <Home className="w-4 h-4" />
                    Individual Spaces
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBookingMode('packages'); setSelectedSpaceIds([]); }}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md transition-colors',
                      bookingMode === 'packages'
                        ? 'bg-accent-yellow text-charcoal-black'
                        : 'text-muted-gray hover:text-bone-white'
                    )}
                  >
                    <Package className="w-4 h-4" />
                    Packages
                  </button>
                </div>
              </div>

              {/* Space Selection */}
              {bookingMode === 'spaces' && (
                <div className="border-t border-muted-gray/30 pt-4">
                  <Label className="text-sm font-medium mb-3 block">Select Spaces *</Label>
                  {spaces.length === 0 ? (
                    <div className="text-center py-6 bg-charcoal-black/30 rounded-lg">
                      <Home className="w-8 h-8 mx-auto text-muted-gray mb-2" />
                      <p className="text-sm text-muted-gray">No available spaces</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {spaces.map((space) => (
                        <button
                          key={space.id}
                          type="button"
                          onClick={() => toggleSpace(space.id)}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                            selectedSpaceIds.includes(space.id)
                              ? 'border-accent-yellow bg-accent-yellow/10'
                              : 'border-muted-gray/30 hover:border-muted-gray/50 bg-charcoal-black/30'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded flex items-center justify-center',
                              selectedSpaceIds.includes(space.id)
                                ? 'bg-accent-yellow/20'
                                : 'bg-muted-gray/20'
                            )}>
                              <Home className={cn(
                                'w-4 h-4',
                                selectedSpaceIds.includes(space.id) ? 'text-accent-yellow' : 'text-muted-gray'
                              )} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-bone-white">{space.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-gray">
                                {space.internal_id && <code>{space.internal_id}</code>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {selectedSpaceIds.includes(space.id) ? (
                              <CheckCircle2 className="w-5 h-5 text-accent-yellow" />
                            ) : (
                              <div className="text-xs text-muted-gray">
                                {space.daily_rate && <div>${space.daily_rate}/day</div>}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedSpaceIds.length > 0 && (
                    <p className="text-xs text-muted-gray mt-2">
                      {selectedSpaceIds.length} space{selectedSpaceIds.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
              )}

              {/* Package Selection */}
              {bookingMode === 'packages' && (
                <div className="border-t border-muted-gray/30 pt-4">
                  <Label className="text-sm font-medium mb-3 block">Select Package *</Label>
                  {packages.length === 0 ? (
                    <div className="text-center py-6 bg-charcoal-black/30 rounded-lg">
                      <Package className="w-8 h-8 mx-auto text-muted-gray mb-2" />
                      <p className="text-sm text-muted-gray">No packages available</p>
                      <p className="text-xs text-muted-gray mt-1">Create packages in the Packages tab</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          onClick={() => setSelectedPackageId(pkg.id)}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                            selectedPackageId === pkg.id
                              ? 'border-accent-yellow bg-accent-yellow/10'
                              : 'border-muted-gray/30 hover:border-muted-gray/50 bg-charcoal-black/30'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              'w-8 h-8 rounded flex items-center justify-center',
                              selectedPackageId === pkg.id ? 'bg-accent-yellow/20' : 'bg-muted-gray/20'
                            )}>
                              <Package className={cn(
                                'w-4 h-4',
                                selectedPackageId === pkg.id ? 'text-accent-yellow' : 'text-muted-gray'
                              )} />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-bone-white">{pkg.name}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-gray">
                                {pkg.space_count && <span>{pkg.space_count} spaces</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            {selectedPackageId === pkg.id ? (
                              <CheckCircle2 className="w-5 h-5 text-accent-yellow" />
                            ) : (
                              <div className="text-xs text-muted-gray">
                                {pkg.daily_rate && <div>${pkg.daily_rate}/day</div>}
                                {pkg.half_day_rate && <div>${pkg.half_day_rate}/4hr</div>}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Rate Type Selection */}
              {hasSelection && (
                <div className="border-t border-muted-gray/30 pt-4">
                  <Label className="text-sm font-medium mb-3 block">Rate Type</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['hourly', 'half_day', 'daily', 'weekly', 'monthly'] as RateType[]).map((type) => {
                      const hasRate = bookingMode === 'packages'
                        ? selectedPackage?.[`${type}_rate` as keyof SetHousePackageInstance]
                        : selectedSpaces.some(s => s[`${type}_rate` as keyof SetHouseSpace]);

                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setRateType(type)}
                          disabled={!hasRate}
                          className={cn(
                            'px-3 py-1.5 rounded-md text-sm transition-colors',
                            rateType === type
                              ? 'bg-accent-yellow text-charcoal-black'
                              : hasRate
                                ? 'bg-charcoal-black/50 border border-muted-gray/30 text-bone-white hover:border-muted-gray/50'
                                : 'bg-charcoal-black/20 border border-muted-gray/20 text-muted-gray/50 cursor-not-allowed'
                          )}
                        >
                          {RATE_LABELS[type]}
                        </button>
                      );
                    })}
                  </div>
                  {calculateTotal() > 0 && (
                    <div className="mt-3 p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-bone-white">Estimated Total:</span>
                        <span className="text-lg font-bold text-accent-yellow">
                          ${calculateTotal().toLocaleString()}
                          <span className="text-xs font-normal text-muted-gray ml-1">
                            /{RATE_LABELS[rateType].toLowerCase()}
                          </span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Date Range */}
              <div className="border-t border-muted-gray/30 pt-4">
                <Label className="text-sm font-medium mb-3 block">Booking Dates *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-date" className="text-xs text-muted-gray">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="end-date" className="text-xs text-muted-gray">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Client Selection */}
              <div className="border-t border-muted-gray/30 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-medium">Client</Label>
                  {!isCreatingClient && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCreatingClient(true)}
                      className="text-accent-yellow hover:text-accent-yellow/80"
                    >
                      <UserPlus className="w-4 h-4 mr-1" />
                      Add New
                    </Button>
                  )}
                </div>

                {isCreatingClient ? (
                  <div className="space-y-4 p-4 bg-charcoal-black/30 rounded-lg border border-muted-gray/30">
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewClientType('company')}
                          className={cn(
                            'px-3 py-1 text-sm rounded',
                            newClientType === 'company'
                              ? 'bg-accent-yellow text-charcoal-black'
                              : 'text-muted-gray hover:text-bone-white'
                          )}
                        >
                          Company
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewClientType('contact')}
                          className={cn(
                            'px-3 py-1 text-sm rounded',
                            newClientType === 'contact'
                              ? 'bg-accent-yellow text-charcoal-black'
                              : 'text-muted-gray hover:text-bone-white'
                          )}
                        >
                          Individual
                        </button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingClient(false)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {newClientType === 'company' ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-gray">Company Name *</Label>
                          <Input
                            value={newCompanyName}
                            onChange={(e) => setNewCompanyName(e.target.value)}
                            placeholder="Company name"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-gray">Email</Label>
                            <Input
                              type="email"
                              value={newCompanyEmail}
                              onChange={(e) => setNewCompanyEmail(e.target.value)}
                              placeholder="email@company.com"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-gray">Phone</Label>
                            <Input
                              value={newCompanyPhone}
                              onChange={(e) => setNewCompanyPhone(e.target.value)}
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-gray">First Name *</Label>
                            <Input
                              value={newContactFirstName}
                              onChange={(e) => setNewContactFirstName(e.target.value)}
                              placeholder="First name"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-gray">Last Name *</Label>
                            <Input
                              value={newContactLastName}
                              onChange={(e) => setNewContactLastName(e.target.value)}
                              placeholder="Last name"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-gray">Email</Label>
                            <Input
                              type="email"
                              value={newContactEmail}
                              onChange={(e) => setNewContactEmail(e.target.value)}
                              placeholder="email@example.com"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-gray">Phone</Label>
                            <Input
                              value={newContactPhone}
                              onChange={(e) => setNewContactPhone(e.target.value)}
                              placeholder="(555) 123-4567"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-gray">Company</Label>
                          <Input
                            value={newContactCompany}
                            onChange={(e) => setNewContactCompany(e.target.value)}
                            placeholder="Company name (optional)"
                          />
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={handleCreateClient}
                      disabled={isCreatingClientLoading}
                      className="w-full"
                    >
                      {isCreatingClientLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        `Create ${newClientType === 'company' ? 'Company' : 'Contact'}`
                      )}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Selected client display */}
                    {(selectedCompany || selectedContact) && (
                      <div className="flex items-center justify-between p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          {selectedCompany ? (
                            <>
                              <Building2 className="w-4 h-4 text-accent-yellow" />
                              <span className="text-sm text-bone-white">{selectedCompany.name}</span>
                            </>
                          ) : selectedContact ? (
                            <>
                              <User className="w-4 h-4 text-accent-yellow" />
                              <span className="text-sm text-bone-white">
                                {selectedContact.first_name} {selectedContact.last_name}
                              </span>
                            </>
                          ) : null}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => { setSelectedCompanyId(null); setSelectedContactId(null); }}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}

                    {/* Client search */}
                    {!selectedCompany && !selectedContact && (
                      <>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
                          <Input
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            placeholder="Search clients..."
                            className="pl-9"
                          />
                        </div>

                        {clientSearch && (filteredCompanies.length > 0 || filteredContacts.length > 0) && (
                          <div className="max-h-40 overflow-y-auto border border-muted-gray/30 rounded-lg">
                            {filteredCompanies.length > 0 && (
                              <div>
                                <div className="px-3 py-1.5 text-xs text-muted-gray bg-charcoal-black/50">Companies</div>
                                {filteredCompanies.map((company) => (
                                  <button
                                    key={company.id}
                                    type="button"
                                    onClick={() => { setSelectedCompanyId(company.id); setClientSearch(''); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-charcoal-black/30 text-left"
                                  >
                                    <Building2 className="w-4 h-4 text-muted-gray" />
                                    <span className="text-sm text-bone-white">{company.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                            {filteredContacts.length > 0 && (
                              <div>
                                <div className="px-3 py-1.5 text-xs text-muted-gray bg-charcoal-black/50">Contacts</div>
                                {filteredContacts.map((contact) => (
                                  <button
                                    key={contact.id}
                                    type="button"
                                    onClick={() => { setSelectedContactId(contact.id); setClientSearch(''); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-charcoal-black/30 text-left"
                                  >
                                    <User className="w-4 h-4 text-muted-gray" />
                                    <div>
                                      <span className="text-sm text-bone-white">
                                        {contact.first_name} {contact.last_name}
                                      </span>
                                      {contact.email && (
                                        <span className="text-xs text-muted-gray ml-2">{contact.email}</span>
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {clientSearch && filteredCompanies.length === 0 && filteredContacts.length === 0 && (
                          <p className="text-sm text-muted-gray text-center py-2">
                            No clients found. Click "Add New" to create one.
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="border-t border-muted-gray/30 pt-4">
                <Label htmlFor="booking-notes" className="text-sm font-medium mb-3 block">Notes</Label>
                <Textarea
                  id="booking-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special requirements, access instructions, etc."
                  rows={3}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-primary-red mt-4 max-h-24 overflow-y-auto flex-shrink-0">
              {error}
            </div>
          )}

          <DialogFooter className="mt-6 flex-shrink-0">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasSelection}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Booking'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
