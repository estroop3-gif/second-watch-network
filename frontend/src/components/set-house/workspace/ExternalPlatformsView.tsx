/**
 * External Platforms View
 * Main view for managing external booking platform integrations
 */
import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  Plus,
  Calendar,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink,
  Search,
  Filter,
  LayoutGrid,
  List,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import {
  useExternalPlatforms,
  useExternalBookings,
  useExternalSyncLogs,
  useValidateICalUrl,
  useCSVUpload,
  useCSVImport,
  useDownloadCSVTemplate,
  useSetHouseSpaces,
} from '@/hooks/set-house';

import { PlatformCard } from './external-platforms/PlatformCard';
import { AddPlatformDialog } from './external-platforms/AddPlatformDialog';
import { ImportCSVDialog } from './external-platforms/ImportCSVDialog';
import { SyncLogDialog } from './external-platforms/SyncLogDialog';

import type { ExternalPlatform, ExternalPlatformType } from '@/types/set-house';

interface ExternalPlatformsViewProps {
  orgId: string;
}

const PLATFORM_TYPE_LABELS: Record<ExternalPlatformType, string> = {
  peerspace: 'Peerspace',
  giggster: 'Giggster',
  splacer: 'Splacer',
  spacetoco: 'Spacetoco',
  ical: 'iCal Feed',
  csv: 'CSV Import',
  manual: 'Manual',
};

export function ExternalPlatformsView({ orgId }: ExternalPlatformsViewProps) {
  const [activeTab, setActiveTab] = useState<'platforms' | 'bookings'>('platforms');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<ExternalPlatform | null>(null);
  const [isSyncLogOpen, setIsSyncLogOpen] = useState(false);
  const [platformToDelete, setPlatformToDelete] = useState<ExternalPlatform | null>(null);
  const [syncingPlatformId, setSyncingPlatformId] = useState<string | null>(null);

  // Hooks
  const {
    platforms,
    isLoading: isLoadingPlatforms,
    createPlatform,
    updatePlatform,
    deletePlatform,
    triggerSync,
  } = useExternalPlatforms(orgId);

  const { bookings, isLoading: isLoadingBookings } = useExternalBookings(orgId, {
    enabled: activeTab === 'bookings',
  });

  const { logs, isLoading: isLoadingLogs } = useExternalSyncLogs(
    orgId,
    selectedPlatform?.id || null,
    { enabled: isSyncLogOpen && !!selectedPlatform }
  );

  const { validateUrl } = useValidateICalUrl(orgId);
  const { uploadCSV, isUploading, reset: resetUpload } = useCSVUpload(orgId);
  const { importCSV, isImporting } = useCSVImport(orgId);
  const { downloadTemplate } = useDownloadCSVTemplate(orgId);
  const { spaces } = useSetHouseSpaces(orgId);

  // Handlers
  const handleCreatePlatform = async (data: Parameters<typeof createPlatform.mutateAsync>[0]) => {
    await createPlatform.mutateAsync(data);
    setIsAddDialogOpen(false);
  };

  const handleValidateUrl = async (url: string) => {
    return validateUrl.mutateAsync(url);
  };

  const handleSync = async (platformId: string) => {
    setSyncingPlatformId(platformId);
    try {
      await triggerSync.mutateAsync(platformId);
    } finally {
      setSyncingPlatformId(null);
    }
  };

  const handleToggleActive = async (platform: ExternalPlatform) => {
    await updatePlatform.mutateAsync({
      platformId: platform.id,
      is_active: !platform.is_active,
    });
  };

  const handleDelete = async () => {
    if (platformToDelete) {
      await deletePlatform.mutateAsync(platformToDelete.id);
      setPlatformToDelete(null);
    }
  };

  const handleViewLogs = (platform: ExternalPlatform) => {
    setSelectedPlatform(platform);
    setIsSyncLogOpen(true);
  };

  const handleCSVUpload = async (file: File) => {
    return uploadCSV.mutateAsync(file);
  };

  const handleCSVImport = async (data: Parameters<typeof importCSV.mutateAsync>[0]) => {
    return importCSV.mutateAsync(data);
  };

  // Filter platforms by search
  const filteredPlatforms = platforms.filter(
    (p) =>
      p.platform_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.platform_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter bookings by search
  const filteredBookings = bookings.filter(
    (b) =>
      (b.client_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (b.external_booking_id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (b.space_name?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-bone-white">External Bookings</h2>
          <p className="text-sm text-muted-gray mt-1">
            Import and track bookings from Peerspace, Giggster, and other platforms
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
          <Button
            onClick={() => setIsAddDialogOpen(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Connect Platform
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <div className="flex items-center justify-between gap-4">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
            <TabsTrigger
              value="platforms"
              className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Platforms ({platforms.length})
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="data-[state=active]:bg-accent-yellow/20 data-[state=active]:text-accent-yellow"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              External Bookings
            </TabsTrigger>
          </TabsList>

          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search..."
              className="pl-9 bg-charcoal-black border-muted-gray/30"
            />
          </div>
        </div>

        {/* Platforms Tab */}
        <TabsContent value="platforms" className="mt-6">
          {isLoadingPlatforms ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : filteredPlatforms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Calendar className="w-16 h-16 text-muted-gray mb-4" />
              <h3 className="text-lg font-medium text-bone-white">No platforms connected</h3>
              <p className="text-muted-gray mt-2 max-w-md">
                Connect your Peerspace, Giggster, or other booking platform calendars
                to automatically import your bookings.
              </p>
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="mt-6 bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Connect Your First Platform
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlatforms.map((platform) => (
                <PlatformCard
                  key={platform.id}
                  platform={platform}
                  onSync={() => handleSync(platform.id)}
                  onEdit={() => {
                    // TODO: Edit dialog
                    console.log('Edit', platform.id);
                  }}
                  onDelete={() => setPlatformToDelete(platform)}
                  onViewLogs={() => handleViewLogs(platform)}
                  onToggleActive={() => handleToggleActive(platform)}
                  isSyncing={syncingPlatformId === platform.id}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Bookings Tab */}
        <TabsContent value="bookings" className="mt-6">
          {isLoadingBookings ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <ExternalLink className="w-16 h-16 text-muted-gray mb-4" />
              <h3 className="text-lg font-medium text-bone-white">No external bookings</h3>
              <p className="text-muted-gray mt-2 max-w-md">
                Bookings imported from external platforms will appear here.
                Connect a platform or import a CSV to get started.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-muted-gray/30 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-muted-gray/30 bg-charcoal-black/50">
                    <TableHead className="text-muted-gray">Platform</TableHead>
                    <TableHead className="text-muted-gray">Booking ID</TableHead>
                    <TableHead className="text-muted-gray">Client</TableHead>
                    <TableHead className="text-muted-gray">Space</TableHead>
                    <TableHead className="text-muted-gray">Dates</TableHead>
                    <TableHead className="text-muted-gray">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => (
                    <TableRow key={booking.id} className="border-muted-gray/30">
                      <TableCell>
                        <Badge variant="outline" className="bg-charcoal-black/50">
                          {PLATFORM_TYPE_LABELS[booking.platform_type as ExternalPlatformType] ||
                            booking.platform_name ||
                            'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {booking.external_booking_id || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-bone-white">{booking.client_name || '-'}</p>
                          {booking.client_email && (
                            <p className="text-xs text-muted-gray">{booking.client_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{booking.space_name || '-'}</TableCell>
                      <TableCell>
                        {booking.scheduled_start ? (
                          <div className="text-sm">
                            <p className="text-bone-white">
                              {format(new Date(booking.scheduled_start), 'MMM d, yyyy')}
                            </p>
                            {booking.scheduled_end && (
                              <p className="text-xs text-muted-gray">
                                {format(new Date(booking.scheduled_start), 'h:mm a')} -{' '}
                                {format(new Date(booking.scheduled_end), 'h:mm a')}
                              </p>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            booking.status === 'confirmed'
                              ? 'bg-green-500/20 text-green-400 border-green-500/30'
                              : booking.status === 'cancelled'
                              ? 'bg-red-500/20 text-red-400 border-red-500/30'
                              : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                          }
                        >
                          {booking.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddPlatformDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleCreatePlatform}
        onValidateUrl={handleValidateUrl}
        spaces={spaces}
        isSubmitting={createPlatform.isPending}
      />

      <ImportCSVDialog
        open={isImportDialogOpen}
        onOpenChange={(open) => {
          setIsImportDialogOpen(open);
          if (!open) resetUpload();
        }}
        onUpload={handleCSVUpload}
        onImport={handleCSVImport}
        onDownloadTemplate={downloadTemplate}
        spaces={spaces}
        isUploading={isUploading}
        isImporting={isImporting}
      />

      <SyncLogDialog
        open={isSyncLogOpen}
        onOpenChange={setIsSyncLogOpen}
        platform={selectedPlatform}
        logs={logs}
        isLoading={isLoadingLogs}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!platformToDelete} onOpenChange={() => setPlatformToDelete(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Remove Platform Connection</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              Are you sure you want to remove "{platformToDelete?.platform_name}"?
              This will stop automatic syncing but won't delete any imported bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-muted-gray/30">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ExternalPlatformsView;
