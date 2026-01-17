/**
 * BookingWizard - Multi-step modal wizard for booking an applicant
 */
import React, { useState } from 'react';
import { X, Check, ChevronRight, ChevronLeft, Loader2, User, DollarSign, FileText, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useApplicationBooking, ApplicationBookingInput } from '@/hooks/applications/useApplicationBooking';

interface BookingWizardProps {
  open: boolean;
  onClose: () => void;
  applicationId: string;
  applicantName: string;
  collabTitle: string;
  collabType: string;
  rateExpectation?: string;
  // For cast-specific options
  isCastRole?: boolean;
  characters?: Array<{ id: string; name: string }>;
}

type WizardStep = 'role' | 'terms' | 'documents' | 'confirm';

const DOCUMENT_TYPES = [
  { id: 'deal_memo', label: 'Deal Memo' },
  { id: 'w9', label: 'W-9' },
  { id: 'nda', label: 'NDA' },
  { id: 'emergency_contact', label: 'Emergency Contact' },
  { id: 'i9', label: 'I-9' },
  { id: 'talent_rider', label: 'Talent Rider' },
];

const CONTRACT_TYPES = [
  { value: 'sag', label: 'SAG-AFTRA' },
  { value: 'non_union', label: 'Non-Union' },
  { value: 'sag_new_media', label: 'SAG New Media' },
  { value: 'sag_ultra_low', label: 'SAG Ultra Low Budget' },
  { value: 'sag_modified_low', label: 'SAG Modified Low Budget' },
];

const BookingWizard: React.FC<BookingWizardProps> = ({
  open,
  onClose,
  applicationId,
  applicantName,
  collabTitle,
  collabType,
  rateExpectation,
  isCastRole = false,
  characters = [],
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('role');
  const { bookApplicant } = useApplicationBooking(applicationId);

  // Form state
  const [roleTitle, setRoleTitle] = useState(collabTitle);
  const [department, setDepartment] = useState(isCastRole ? 'cast' : 'crew');
  const [characterId, setCharacterId] = useState<string>('');
  const [billingPosition, setBillingPosition] = useState<number | undefined>();
  const [contractType, setContractType] = useState<string>('');

  const [bookingRate, setBookingRate] = useState(rateExpectation || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');

  const [requestDocuments, setRequestDocuments] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);

  const [sendNotification, setSendNotification] = useState(true);
  const [notificationMessage, setNotificationMessage] = useState(
    `Congratulations! You've been booked for ${collabTitle}.`
  );

  const steps: { id: WizardStep; label: string; icon: React.ReactNode }[] = [
    { id: 'role', label: 'Role', icon: <User className="h-4 w-4" /> },
    { id: 'terms', label: 'Terms', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
    { id: 'confirm', label: 'Confirm', icon: <Send className="h-4 w-4" /> },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  const handleDocumentToggle = (docId: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(docId)
        ? prev.filter((d) => d !== docId)
        : [...prev, docId]
    );
  };

  const handleSubmit = async () => {
    const bookingData: ApplicationBookingInput = {
      role_title: roleTitle,
      department,
      booking_rate: bookingRate || undefined,
      booking_start_date: startDate || undefined,
      booking_end_date: endDate || undefined,
      booking_notes: bookingNotes || undefined,
      booking_schedule_notes: scheduleNotes || undefined,
      request_documents: requestDocuments,
      document_types: requestDocuments ? selectedDocuments : undefined,
      send_notification: sendNotification,
      notification_message: sendNotification ? notificationMessage : undefined,
    };

    // Cast-specific fields
    if (isCastRole) {
      if (characterId) bookingData.character_id = characterId;
      if (billingPosition) bookingData.billing_position = billingPosition;
      if (contractType) bookingData.contract_type = contractType;
    }

    try {
      await bookApplicant.mutateAsync(bookingData);
      toast.success(`${applicantName} has been booked!`);
      onClose();
    } catch (error) {
      console.error('Failed to book applicant:', error);
      toast.error('Failed to book applicant. Please try again.');
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <button
            onClick={() => index <= currentStepIndex && setCurrentStep(step.id)}
            disabled={index > currentStepIndex}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              step.id === currentStep
                ? 'bg-accent-yellow text-charcoal-black'
                : index < currentStepIndex
                ? 'bg-accent-yellow/30 text-bone-white cursor-pointer hover:bg-accent-yellow/40'
                : 'bg-muted-gray/20 text-muted-gray cursor-not-allowed'
            )}
          >
            {index < currentStepIndex ? (
              <Check className="h-3 w-3" />
            ) : (
              step.icon
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </button>
          {index < steps.length - 1 && (
            <ChevronRight className="h-4 w-4 text-muted-gray/50" />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderRoleStep = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="roleTitle" className="text-bone-white">Role Title</Label>
        <Input
          id="roleTitle"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="e.g., Director of Photography"
          className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
        />
      </div>

      <div>
        <Label htmlFor="department" className="text-bone-white">Department</Label>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
            <SelectValue placeholder="Select department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cast">Cast</SelectItem>
            <SelectItem value="crew">Crew</SelectItem>
            <SelectItem value="production">Production</SelectItem>
            <SelectItem value="post">Post-Production</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isCastRole && (
        <>
          {characters.length > 0 && (
            <div>
              <Label htmlFor="character" className="text-bone-white">Assign to Character</Label>
              <Select value={characterId} onValueChange={setCharacterId}>
                <SelectTrigger className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
                  <SelectValue placeholder="Select character (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No character assigned</SelectItem>
                  {characters.map((char) => (
                    <SelectItem key={char.id} value={char.id}>
                      {char.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="billingPosition" className="text-bone-white">Billing Position</Label>
            <Input
              id="billingPosition"
              type="number"
              min={1}
              value={billingPosition || ''}
              onChange={(e) => setBillingPosition(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 1 for top billing"
              className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
            />
            <p className="text-xs text-muted-gray mt-1">1 = Top billing, 2 = Second, etc.</p>
          </div>

          <div>
            <Label htmlFor="contractType" className="text-bone-white">Contract Type</Label>
            <Select value={contractType} onValueChange={setContractType}>
              <SelectTrigger className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
                <SelectValue placeholder="Select contract type" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );

  const renderTermsStep = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="bookingRate" className="text-bone-white">Rate / Compensation</Label>
        <Input
          id="bookingRate"
          value={bookingRate}
          onChange={(e) => setBookingRate(e.target.value)}
          placeholder="e.g., $500/day, $2,500/week"
          className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
        />
        {rateExpectation && (
          <p className="text-xs text-muted-gray mt-1">
            Their expectation: {rateExpectation}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startDate" className="text-bone-white">Start Date</Label>
          <Input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
          />
        </div>
        <div>
          <Label htmlFor="endDate" className="text-bone-white">End Date</Label>
          <Input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="scheduleNotes" className="text-bone-white">Schedule Notes</Label>
        <Textarea
          id="scheduleNotes"
          value={scheduleNotes}
          onChange={(e) => setScheduleNotes(e.target.value)}
          placeholder="e.g., Mon-Fri, 7am call times expected"
          className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white min-h-[80px]"
        />
      </div>

      <div>
        <Label htmlFor="bookingNotes" className="text-bone-white">Internal Notes</Label>
        <Textarea
          id="bookingNotes"
          value={bookingNotes}
          onChange={(e) => setBookingNotes(e.target.value)}
          placeholder="Notes for your records (not shared with applicant)"
          className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white min-h-[80px]"
        />
      </div>
    </div>
  );

  const renderDocumentsStep = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <Checkbox
          id="requestDocuments"
          checked={requestDocuments}
          onCheckedChange={(checked) => setRequestDocuments(checked === true)}
        />
        <Label htmlFor="requestDocuments" className="text-bone-white cursor-pointer">
          Request documents from {applicantName}
        </Label>
      </div>

      {requestDocuments && (
        <div className="pl-6 space-y-3 border-l-2 border-accent-yellow/30">
          <p className="text-sm text-muted-gray">
            Select the documents you need:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DOCUMENT_TYPES.map((doc) => (
              <div key={doc.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`doc-${doc.id}`}
                  checked={selectedDocuments.includes(doc.id)}
                  onCheckedChange={() => handleDocumentToggle(doc.id)}
                />
                <Label
                  htmlFor={`doc-${doc.id}`}
                  className="text-sm text-bone-white cursor-pointer"
                >
                  {doc.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {!requestDocuments && (
        <div className="text-center py-6 text-muted-gray">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            You can request documents later from the team management page.
          </p>
        </div>
      )}
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-4">
      <div className="bg-charcoal-black/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-bone-white">Booking Summary</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <span className="text-muted-gray">Applicant:</span>
          <span className="text-bone-white">{applicantName}</span>

          <span className="text-muted-gray">Role:</span>
          <span className="text-bone-white">{roleTitle}</span>

          <span className="text-muted-gray">Department:</span>
          <span className="text-bone-white capitalize">{department}</span>

          {bookingRate && (
            <>
              <span className="text-muted-gray">Rate:</span>
              <span className="text-bone-white">{bookingRate}</span>
            </>
          )}

          {startDate && (
            <>
              <span className="text-muted-gray">Start Date:</span>
              <span className="text-bone-white">{startDate}</span>
            </>
          )}

          {endDate && (
            <>
              <span className="text-muted-gray">End Date:</span>
              <span className="text-bone-white">{endDate}</span>
            </>
          )}

          {requestDocuments && selectedDocuments.length > 0 && (
            <>
              <span className="text-muted-gray">Documents:</span>
              <span className="text-bone-white">
                {selectedDocuments.length} requested
              </span>
            </>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="sendNotification"
            checked={sendNotification}
            onCheckedChange={(checked) => setSendNotification(checked === true)}
          />
          <Label htmlFor="sendNotification" className="text-bone-white cursor-pointer">
            Send notification to {applicantName}
          </Label>
        </div>

        {sendNotification && (
          <div className="pl-6 border-l-2 border-accent-yellow/30">
            <Label htmlFor="notificationMessage" className="text-sm text-muted-gray">
              Notification message:
            </Label>
            <Textarea
              id="notificationMessage"
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              className="mt-1 bg-charcoal-black/50 border-muted-gray/30 text-bone-white min-h-[100px]"
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <User className="h-5 w-5 text-accent-yellow" />
            Book {applicantName}
          </DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="min-h-[300px]">
          {currentStep === 'role' && renderRoleStep()}
          {currentStep === 'terms' && renderTermsStep()}
          {currentStep === 'documents' && renderDocumentsStep()}
          {currentStep === 'confirm' && renderConfirmStep()}
        </div>

        <div className="flex justify-between pt-4 border-t border-muted-gray/20">
          <Button
            variant="ghost"
            onClick={currentStepIndex === 0 ? onClose : handlePrevious}
            className="text-muted-gray hover:text-bone-white"
          >
            {currentStepIndex === 0 ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back
              </>
            )}
          </Button>

          {currentStep === 'confirm' ? (
            <Button
              onClick={handleSubmit}
              disabled={bookApplicant.isPending}
              className="bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
            >
              {bookApplicant.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Booking...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Confirm Booking
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingWizard;
