/**
 * PersonClearancesSection - Shows clearances per person in the Documents tab
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Download,
  Send,
  Eye,
  ChevronDown,
  ChevronRight,
  User,
  FileCheck,
  FileX,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Mail,
  Building,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { usePersonClearancesDetailed } from '@/hooks/backlot';
import { BacklotBookedPerson, CLEARANCE_TYPE_LABELS, ClearanceRecipient } from '@/types/backlot';
import { cn } from '@/lib/utils';

interface PersonClearancesSectionProps {
  projectId: string;
  bookedPeople: BacklotBookedPerson[];
  onNavigateToClearances?: (personId?: string, personName?: string) => void;
  onOpenSendModal?: (clearanceId: string) => void;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'signed':
      return <Badge className="bg-green-500/10 text-green-400 border-green-500/30"><CheckCircle2 className="w-3 h-3 mr-1" />Signed</Badge>;
    case 'requested':
    case 'pending':
      return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
    case 'not_started':
      return <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/30"><FileX className="w-3 h-3 mr-1" />Not Started</Badge>;
    case 'expired':
      return <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Expired</Badge>;
    case 'rejected':
      return <Badge className="bg-red-500/10 text-red-400 border-red-500/30"><AlertTriangle className="w-3 h-3 mr-1" />Rejected</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getRecipientIcon(type: string) {
  switch (type) {
    case 'contact':
      return <Building className="w-3 h-3 text-blue-400" />;
    case 'member':
      return <User className="w-3 h-3 text-green-400" />;
    default:
      return <Mail className="w-3 h-3 text-muted-foreground" />;
  }
}

function getSignatureStatusBadge(status: string) {
  switch (status) {
    case 'signed':
      return <span className="text-xs text-green-400">Signed</span>;
    case 'viewed':
      return <span className="text-xs text-blue-400">Viewed</span>;
    case 'pending':
      return <span className="text-xs text-yellow-400">Pending</span>;
    default:
      return <span className="text-xs text-muted-foreground">N/A</span>;
  }
}

interface ClearanceRowProps {
  clearance: {
    id: string;
    title: string;
    type: string;
    status: string;
    file_url: string | null;
    signed_date: string | null;
    recipients?: ClearanceRecipient[];
  };
  onView?: () => void;
  onSend?: () => void;
}

function ClearanceRow({ clearance, onView, onSend }: ClearanceRowProps) {
  const [expanded, setExpanded] = useState(false);
  const recipients = clearance.recipients || [];
  const hasRecipients = recipients.length > 0;

  return (
    <div className="border-b border-muted-gray/20 last:border-0">
      <div className="flex items-center gap-3 py-3 px-2">
        {/* Expand button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-bone-white"
          disabled={!hasRecipients}
        >
          {hasRecipients ? (
            expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4" />
          )}
        </button>

        {/* Type Icon + Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-bone-white truncate">{clearance.title}</p>
            <p className="text-xs text-muted-foreground">{CLEARANCE_TYPE_LABELS[clearance.type] || clearance.type}</p>
          </div>
        </div>

        {/* Document */}
        <div className="w-20 shrink-0">
          {clearance.file_url ? (
            <a
              href={clearance.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-red hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-3 h-3" />
              Download
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">No file</span>
          )}
        </div>

        {/* Status */}
        <div className="w-24 shrink-0">
          {getStatusBadge(clearance.status)}
        </div>

        {/* Recipients count */}
        <div className="w-20 shrink-0 text-center">
          {hasRecipients ? (
            <Badge variant="outline" className="text-xs">
              <Users className="w-3 h-3 mr-1" />
              {recipients.length}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {onView && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView}>
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {onSend && clearance.file_url && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSend}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Recipients */}
      {expanded && hasRecipients && (
        <div className="pl-10 pr-2 pb-3">
          <div className="bg-muted-gray/10 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recipients</p>
            {recipients.map((recipient) => (
              <div key={recipient.id} className="flex items-center gap-3 text-sm">
                {getRecipientIcon(recipient.recipient_type)}
                <span className="text-bone-white">{recipient.name}</span>
                <span className="text-muted-foreground text-xs">{recipient.email}</span>
                <span className="flex-1" />
                {recipient.requires_signature && getSignatureStatusBadge(recipient.signature_status)}
                {recipient.signed_at && (
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(recipient.signed_at), 'MMM d, yyyy')}
                  </span>
                )}
                {recipient.last_email_sent_at && !recipient.signed_at && (
                  <span className="text-xs text-muted-foreground">
                    Sent {format(parseISO(recipient.last_email_sent_at), 'MMM d')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function PersonClearancesSection({
  projectId,
  bookedPeople,
  onNavigateToClearances,
  onOpenSendModal,
}: PersonClearancesSectionProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | 'all'>('all');
  const [isOpen, setIsOpen] = useState(true);

  // Get clearances for selected person
  const personId = selectedPersonId === 'all' ? null : selectedPersonId;
  const { data, isLoading } = usePersonClearancesDetailed(
    projectId,
    personId
  );

  const clearances = data?.clearances || [];
  const summary = data?.summary || { total: 0, signed: 0, pending: 0, missing: 0 };

  const selectedPerson = bookedPeople.find(p => p.user_id === selectedPersonId);

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted-gray/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-bone-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary-red" />
                Clearances
                {summary.total > 0 && (
                  <Badge variant="outline" className="ml-2">
                    {summary.signed}/{summary.total} Signed
                  </Badge>
                )}
              </CardTitle>
              {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Person Filter */}
            <div className="flex items-center gap-4">
              <Select value={selectedPersonId} onValueChange={setSelectedPersonId}>
                <SelectTrigger className="w-64 bg-muted-gray/10 border-muted-gray/30">
                  <SelectValue placeholder="Select a person" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Booked People</SelectItem>
                  {bookedPeople.map((person) => (
                    <SelectItem key={person.user_id} value={person.user_id}>
                      {person.name} - {person.role_title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {onNavigateToClearances && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onNavigateToClearances(personId || undefined, selectedPerson?.name)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View All Clearances
                </Button>
              )}
            </div>

            {/* No person selected message */}
            {selectedPersonId === 'all' && (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Select a person above to view their clearances</p>
              </div>
            )}

            {/* Clearances List */}
            {selectedPersonId !== 'all' && (
              <>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading clearances...
                  </div>
                ) : clearances.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileX className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No clearances found for {selectedPerson?.name || 'this person'}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={() => onNavigateToClearances?.(personId || undefined, selectedPerson?.name)}
                    >
                      Create Clearance
                    </Button>
                  </div>
                ) : (
                  <div className="border border-muted-gray/30 rounded-lg overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center gap-3 py-2 px-2 bg-muted-gray/10 text-xs font-medium text-muted-foreground">
                      <span className="w-4" />
                      <span className="flex-1">Clearance</span>
                      <span className="w-20">Document</span>
                      <span className="w-24">Status</span>
                      <span className="w-20 text-center">Recipients</span>
                      <span className="w-16">Actions</span>
                    </div>

                    {/* Rows */}
                    <ScrollArea className="max-h-96">
                      {clearances.map((clearance) => (
                        <ClearanceRow
                          key={clearance.id}
                          clearance={clearance}
                          onView={() => onNavigateToClearances?.(personId || undefined, selectedPerson?.name)}
                          onSend={() => onOpenSendModal?.(clearance.id)}
                        />
                      ))}
                    </ScrollArea>
                  </div>
                )}

                {/* Summary */}
                {clearances.length > 0 && (
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">Summary:</span>
                    <Badge className="bg-green-500/10 text-green-400">{summary.signed} Signed</Badge>
                    <Badge className="bg-yellow-500/10 text-yellow-400">{summary.pending} Pending</Badge>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default PersonClearancesSection;
