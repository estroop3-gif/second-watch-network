/**
 * ClearanceDetailPage - Main clearance detail page with header and tabs
 * Shows clearance info, document viewer, E&O linking, and history
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  FileText,
  User,
  MapPin,
  Tag,
  Calendar,
  History,
  Shield,
  FileCheck,
  FileX,
  Clock,
  AlertTriangle,
  Users,
  Send,
} from 'lucide-react';
import { differenceInDays, isPast } from 'date-fns';
import { formatDate, parseLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import {
  BacklotClearanceItem,
  CLEARANCE_TYPE_LABELS,
  CLEARANCE_TYPE_COLORS,
  CLEARANCE_STATUS_LABELS,
} from '@/types/backlot';
import { useClearanceDocumentVersions } from '@/hooks/backlot/useClearances';
import ClearanceInfoTab from './ClearanceInfoTab';
import ClearanceDocumentTab from './ClearanceDocumentTab';
import ClearanceEOTab from './ClearanceEOTab';
import ClearanceRecipientsTab from './ClearanceRecipientsTab';
import ClearanceSendModal from './ClearanceSendModal';
import { ClearanceHistoryTimeline } from './ClearanceHistoryTimeline';
import { ClearanceApprovalTab } from './ClearanceApprovalTab';
import { useClearanceRecipients, useClearanceApproval } from '@/hooks/backlot';

interface ClearanceDetailPageProps {
  projectId: string;
  clearance: BacklotClearanceItem;
  canEdit: boolean;
  onBack: () => void;
}

function getStatusBadgeClass(status: string): string {
  const classes: Record<string, string> = {
    signed: 'bg-green-500/10 text-green-400 border-green-500/30',
    requested: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
    pending: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    not_started: 'bg-gray-500/10 text-gray-500 border-gray-500/30',
    expired: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return classes[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30';
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'talent_release':
    case 'appearance_release':
      return User;
    case 'location_release':
      return MapPin;
    default:
      return FileText;
  }
}

export default function ClearanceDetailPage({
  projectId,
  clearance,
  canEdit,
  onBack,
}: ClearanceDetailPageProps) {
  const [activeTab, setActiveTab] = useState('info');
  const [showSendModal, setShowSendModal] = useState(false);
  const { data: versions } = useClearanceDocumentVersions(clearance.id);
  const { recipients } = useClearanceRecipients(clearance.id);
  const { data: approval } = useClearanceApproval(clearance.id);

  // Show approval tab if document is signed and requires approval
  const showApprovalTab = clearance.status === 'signed' && approval?.requires_approval;

  const TypeIcon = getTypeIcon(clearance.type);
  const typeLabel = CLEARANCE_TYPE_LABELS[clearance.type] || clearance.type;
  const typeColor = CLEARANCE_TYPE_COLORS[clearance.type] || 'gray';
  const statusLabel = CLEARANCE_STATUS_LABELS[clearance.status] || clearance.status;
  const versionCount = versions?.length || 0;

  // Calculate days until expiry
  const expirationDate = clearance.expiration_date ? parseLocalDate(clearance.expiration_date) : null;
  const daysUntilExpiry = expirationDate ? differenceInDays(expirationDate, new Date()) : null;
  const isExpired = expirationDate ? isPast(expirationDate) : false;
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30;

  // Get related entity name
  const relatedName = clearance.related_person_name
    || clearance.related_location?.name
    || clearance.related_asset_label
    || null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="mt-1 shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>

        <div className="flex-1 min-w-0">
          {/* Send Button */}
          {clearance.file_url && canEdit && recipients.length > 0 && (
            <div className="float-right ml-4">
              <Button
                onClick={() => setShowSendModal(true)}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                <Send className="w-4 h-4 mr-2" />
                Send Document
              </Button>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className={cn(
              'w-12 h-12 rounded-lg flex items-center justify-center shrink-0',
              `bg-${typeColor}-500/20`
            )}>
              <TypeIcon className={cn('w-6 h-6', `text-${typeColor}-400`)} />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-heading text-bone-white truncate">
                {clearance.title}
              </h2>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className={`border ${getStatusBadgeClass(clearance.status)}`}>
                  {statusLabel}
                </Badge>

                <Badge variant="outline" className="text-muted-foreground">
                  {typeLabel}
                </Badge>

                {clearance.file_url ? (
                  <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">
                    <FileCheck className="w-3 h-3 mr-1" />
                    Document
                  </Badge>
                ) : (
                  <Badge className="bg-gray-500/10 text-gray-500 border border-gray-500/30">
                    <FileX className="w-3 h-3 mr-1" />
                    No Document
                  </Badge>
                )}

                {clearance.is_eo_critical && (
                  <Badge className="bg-red-500/10 text-red-400 border border-red-500/30">
                    <Shield className="w-3 h-3 mr-1" />
                    E&O Critical
                  </Badge>
                )}

                {relatedName && (
                  <span className="text-sm text-muted-foreground">
                    for {relatedName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Status Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Tag className="w-4 h-4" />
              Status
            </div>
            <div className={cn(
              'text-lg font-medium',
              clearance.status === 'signed' ? 'text-green-400' :
              clearance.status === 'expired' ? 'text-orange-400' :
              clearance.status === 'rejected' ? 'text-red-400' : 'text-bone-white'
            )}>
              {statusLabel}
            </div>
            {clearance.signed_date && (
              <div className="text-xs text-muted-foreground mt-1">
                Signed {formatDate(clearance.signed_date)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiration Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="w-4 h-4" />
              Expiration
            </div>
            {expirationDate ? (
              <>
                <div className={cn(
                  'text-lg font-medium',
                  isExpired ? 'text-orange-400' :
                  isExpiringSoon ? 'text-yellow-400' : 'text-bone-white'
                )}>
                  {isExpired ? 'Expired' : `${daysUntilExpiry} days`}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {format(expirationDate, 'MMM d, yyyy')}
                </div>
              </>
            ) : (
              <div className="text-lg font-medium text-muted-foreground">
                No expiry
              </div>
            )}
          </CardContent>
        </Card>

        {/* Document Versions Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <History className="w-4 h-4" />
              Versions
            </div>
            <div className="text-lg font-medium text-bone-white">
              {versionCount === 0 ? 'None' : versionCount}
            </div>
            {versionCount > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                document version{versionCount > 1 ? 's' : ''}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Priority/Workflow Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Clock className="w-4 h-4" />
              Priority
            </div>
            <div className={cn(
              'text-lg font-medium capitalize',
              clearance.priority === 'urgent' ? 'text-red-400' :
              clearance.priority === 'high' ? 'text-orange-400' :
              clearance.priority === 'medium' ? 'text-yellow-400' : 'text-bone-white'
            )}>
              {clearance.priority || 'Normal'}
            </div>
            {clearance.assigned_to && (
              <div className="text-xs text-muted-foreground mt-1">
                Assigned to {clearance.assigned_to.display_name || clearance.assigned_to.full_name}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Warning for E&O Critical without document */}
      {clearance.is_eo_critical && !clearance.file_url && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <p className="font-medium text-red-400">E&O Critical - Document Required</p>
            <p className="text-sm text-muted-foreground">
              This clearance is marked as E&O critical but has no document attached.
            </p>
          </div>
        </div>
      )}

      {/* Tabbed Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start bg-charcoal-black border-b border-muted-gray/30 rounded-none px-0">
          <TabsTrigger
            value="info"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-red rounded-none"
          >
            <FileText className="w-4 h-4 mr-2" />
            Info
          </TabsTrigger>
          <TabsTrigger
            value="document"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-red rounded-none"
          >
            <FileCheck className="w-4 h-4 mr-2" />
            Document
            {clearance.file_url && (
              <span className="ml-1.5 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="eo"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-red rounded-none"
          >
            <Shield className="w-4 h-4 mr-2" />
            E&O
            {clearance.is_eo_critical && (
              <span className="ml-1.5 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </TabsTrigger>
          <TabsTrigger
            value="recipients"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-red rounded-none"
          >
            <Users className="w-4 h-4 mr-2" />
            Recipients
            {recipients.length > 0 && (
              <Badge variant="outline" className="ml-2 text-xs py-0 h-5">
                {recipients.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-red rounded-none"
          >
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          {showApprovalTab && (
            <TabsTrigger
              value="approval"
              className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary-red rounded-none"
            >
              <Shield className="w-4 h-4 mr-2" />
              Approval
              {approval?.approval_status === 'pending_approval' && (
                <span className="ml-1.5 w-2 h-2 bg-yellow-500 rounded-full" />
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="info" className="mt-6">
          <ClearanceInfoTab
            projectId={projectId}
            clearance={clearance}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="document" className="mt-6">
          <ClearanceDocumentTab
            clearance={clearance}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="eo" className="mt-6">
          <ClearanceEOTab
            projectId={projectId}
            clearance={clearance}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="recipients" className="mt-6">
          <ClearanceRecipientsTab
            clearanceId={clearance.id}
            projectId={projectId}
            canEdit={canEdit}
            hasDocument={!!clearance.file_url}
            onOpenSendModal={() => setShowSendModal(true)}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <ClearanceHistoryTimeline clearanceId={clearance.id} />
        </TabsContent>

        {showApprovalTab && (
          <TabsContent value="approval" className="mt-6">
            <ClearanceApprovalTab
              clearance={clearance}
              canApprove={canEdit}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Send Modal */}
      <ClearanceSendModal
        open={showSendModal}
        onOpenChange={setShowSendModal}
        clearanceId={clearance.id}
        clearanceTitle={clearance.title}
      />
    </div>
  );
}
