/**
 * CallSheetDetailView - Enhanced call sheet view with extended fields, custom contacts, and print support
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  FileText,
  Calendar,
  Clock,
  MapPin,
  Mail,
  Phone,
  Users,
  Send,
  History,
  Printer,
  Download,
  AlertTriangle,
  Heart,
  Car,
  Building,
  User,
  Loader2,
  Film,
  Video,
  Music,
  Megaphone,
  Cloud,
  Sunrise,
  Sunset,
  Coffee,
  Camera,
  Volume2,
  Lightbulb,
  Palette,
  Shirt,
  Sparkles,
  Truck,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useCallSheetPeople, useCallSheetSendHistory, useCallSheetLocations, useDownloadCallSheetPdf, useCallSheetSceneLinks } from '@/hooks/backlot';
import { useToast } from '@/hooks/use-toast';
import { BacklotCallSheet, BacklotCallSheetPerson, CallSheetSendHistory, BacklotCallSheetTemplate } from '@/types/backlot';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import CallSheetSyncModal from './CallSheetSyncModal';
import CallSheetSceneLinkModal from './CallSheetSceneLinkModal';
import { ScoutPreviewWidget } from '@/components/backlot/scout-photos';

interface CallSheetDetailViewProps {
  isOpen: boolean;
  onClose: () => void;
  callSheet: BacklotCallSheet;
  projectId: string;
  canEdit: boolean;
  onSend: () => void;
}

// Template icons
const TEMPLATE_ICONS: Record<BacklotCallSheetTemplate, React.ReactNode> = {
  feature: <Film className="w-4 h-4" />,
  documentary: <Video className="w-4 h-4" />,
  music_video: <Music className="w-4 h-4" />,
  commercial: <Megaphone className="w-4 h-4" />,
};

// Template labels
const TEMPLATE_LABELS: Record<BacklotCallSheetTemplate, string> = {
  feature: 'Feature / Episodic',
  documentary: 'Documentary',
  music_video: 'Music Video',
  commercial: 'Commercial',
};

// Department icons
const DEPARTMENT_ICONS: Record<string, React.ReactNode> = {
  camera_notes: <Camera className="w-4 h-4" />,
  sound_notes: <Volume2 className="w-4 h-4" />,
  grip_electric_notes: <Lightbulb className="w-4 h-4" />,
  art_notes: <Palette className="w-4 h-4" />,
  wardrobe_notes: <Shirt className="w-4 h-4" />,
  makeup_hair_notes: <Sparkles className="w-4 h-4" />,
  transport_notes: <Truck className="w-4 h-4" />,
  catering_notes: <Coffee className="w-4 h-4" />,
};

const CallSheetDetailView: React.FC<CallSheetDetailViewProps> = ({
  isOpen,
  onClose,
  callSheet,
  projectId,
  canEdit,
  onSend,
}) => {
  const { toast } = useToast();
  const { people, isLoading: peopleLoading } = useCallSheetPeople(callSheet.id);
  const { sendHistory, isLoading: historyLoading } = useCallSheetSendHistory(callSheet.id);
  const { locations } = useCallSheetLocations(callSheet.id);
  const { data: linkedScenes } = useCallSheetSceneLinks(callSheet.id);
  const downloadPdf = useDownloadCallSheetPdf();
  const [activeTab, setActiveTab] = useState('details');
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showSceneLinkModal, setShowSceneLinkModal] = useState(false);

  // Group people by department
  const peopleByDepartment = people.reduce((acc, person) => {
    const dept = person.department || 'General';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(person);
    return acc;
  }, {} as Record<string, BacklotCallSheetPerson[]>);

  // Separate cast and crew
  const cast = people.filter(p => p.is_cast);
  const crew = people.filter(p => !p.is_cast);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadPdf.mutateAsync(callSheet.id);
      toast({
        title: 'PDF Downloaded',
        description: 'Call sheet PDF has been downloaded.',
      });
    } catch (error: any) {
      toast({
        title: 'Download Failed',
        description: error.message || 'Failed to download PDF',
        variant: 'destructive',
      });
    }
  };

  // Collect department notes that have content
  const departmentNotes = [
    { id: 'camera_notes', label: 'Camera', value: callSheet.camera_notes },
    { id: 'sound_notes', label: 'Sound', value: callSheet.sound_notes },
    { id: 'grip_electric_notes', label: 'Grip & Electric', value: callSheet.grip_electric_notes },
    { id: 'art_notes', label: 'Art / Props', value: callSheet.art_notes },
    { id: 'wardrobe_notes', label: 'Wardrobe', value: callSheet.wardrobe_notes },
    { id: 'makeup_hair_notes', label: 'Makeup & Hair', value: callSheet.makeup_hair_notes },
    { id: 'transport_notes', label: 'Transportation', value: callSheet.transport_notes },
    { id: 'catering_notes', label: 'Craft Services', value: callSheet.catering_notes },
  ].filter(n => n.value);

  // Check if we have any key contacts
  const hasKeyContacts = callSheet.director_name || callSheet.producer_name ||
    callSheet.first_ad_name || callSheet.upm_name || callSheet.production_office_phone;

  // Use locations from the hook or fallback to callSheet.locations
  const displayLocations = locations.length > 0 ? locations : (callSheet.locations || []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-charcoal-black border-muted-gray/30 print:max-w-none print:max-h-none print:border-none print:bg-white">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-bone-white">
              <FileText className="w-5 h-5 text-accent-yellow" />
              <div className="flex flex-col">
                <span>{callSheet.title}</span>
                {callSheet.production_title && (
                  <span className="text-sm font-normal text-muted-gray">{callSheet.production_title}</span>
                )}
              </div>
              <Badge
                variant="outline"
                className={
                  callSheet.is_published
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-muted-gray/20 text-muted-gray border-muted-gray/30'
                }
              >
                {callSheet.is_published ? 'Published' : 'Draft'}
              </Badge>
              {callSheet.template_type && (
                <Badge variant="outline" className="border-accent-yellow/30 text-accent-yellow">
                  {TEMPLATE_ICONS[callSheet.template_type]}
                  <span className="ml-1">{TEMPLATE_LABELS[callSheet.template_type]}</span>
                </Badge>
              )}
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Print Header - Only visible in print */}
        <div className="hidden print:block print:mb-6">
          {callSheet.header_logo_url && (
            <img src={callSheet.header_logo_url} alt="Production Logo" className="h-16 mb-4" />
          )}
          <h1 className="text-2xl font-bold text-black">{callSheet.title}</h1>
          {callSheet.production_title && (
            <div className="text-lg text-gray-700">{callSheet.production_title}</div>
          )}
          <div className="text-lg text-gray-600">
            {format(new Date(callSheet.date), 'EEEE, MMMM d, yyyy')}
            {callSheet.shoot_day_number && callSheet.total_shoot_days && (
              <span className="ml-4">Day {callSheet.shoot_day_number} of {callSheet.total_shoot_days}</span>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="print:hidden">
          <TabsList className="bg-muted-gray/10">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="people">
              People {people.length > 0 && `(${people.length})`}
            </TabsTrigger>
            <TabsTrigger value="scenes">
              Scenes {linkedScenes && linkedScenes.length > 0 && `(${linkedScenes.length})`}
            </TabsTrigger>
            <TabsTrigger value="history">
              History {sendHistory.length > 0 && `(${sendHistory.length})`}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[60vh] pr-4 mt-4">
            {/* Details Tab */}
            <TabsContent value="details" className="space-y-6">
              {/* Production Info Header */}
              <div className="bg-muted-gray/10 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-accent-yellow" />
                    <div>
                      <div className="text-muted-gray text-xs">Date</div>
                      <div className="text-bone-white font-medium">
                        {format(new Date(callSheet.date), 'EEEE, MMMM d, yyyy')}
                      </div>
                    </div>
                  </div>

                  {callSheet.shoot_day_number && (
                    <div className="flex items-center gap-2">
                      <Film className="w-5 h-5 text-accent-yellow" />
                      <div>
                        <div className="text-muted-gray text-xs">Shoot Day</div>
                        <div className="text-bone-white font-medium">
                          Day {callSheet.shoot_day_number}
                          {callSheet.total_shoot_days && ` of ${callSheet.total_shoot_days}`}
                        </div>
                      </div>
                    </div>
                  )}

                  {callSheet.production_company && (
                    <div className="flex items-center gap-2">
                      <Building className="w-5 h-5 text-accent-yellow" />
                      <div>
                        <div className="text-muted-gray text-xs">Production Company</div>
                        <div className="text-bone-white font-medium">{callSheet.production_company}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Call Times */}
              <div className="bg-muted-gray/10 rounded-lg p-4">
                <h4 className="text-sm font-medium text-bone-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-accent-yellow" />
                  Call Times
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {callSheet.crew_call_time && (
                    <div>
                      <div className="text-muted-gray text-xs">Crew Call</div>
                      <div className="text-bone-white font-medium">{callSheet.crew_call_time}</div>
                    </div>
                  )}
                  {callSheet.general_call_time && (
                    <div>
                      <div className="text-muted-gray text-xs">General Call</div>
                      <div className="text-bone-white font-medium">{callSheet.general_call_time}</div>
                    </div>
                  )}
                  {callSheet.first_shot_time && (
                    <div>
                      <div className="text-muted-gray text-xs">First Shot</div>
                      <div className="text-bone-white font-medium">{callSheet.first_shot_time}</div>
                    </div>
                  )}
                  {callSheet.breakfast_time && (
                    <div>
                      <div className="text-muted-gray text-xs">Breakfast</div>
                      <div className="text-muted-gray">{callSheet.breakfast_time}</div>
                    </div>
                  )}
                  {callSheet.lunch_time && (
                    <div>
                      <div className="text-muted-gray text-xs">Lunch</div>
                      <div className="text-muted-gray">{callSheet.lunch_time}</div>
                    </div>
                  )}
                  {callSheet.dinner_time && (
                    <div>
                      <div className="text-muted-gray text-xs">2nd Meal</div>
                      <div className="text-muted-gray">{callSheet.dinner_time}</div>
                    </div>
                  )}
                  {callSheet.estimated_wrap_time && (
                    <div>
                      <div className="text-muted-gray text-xs">Est. Wrap</div>
                      <div className="text-bone-white font-medium">{callSheet.estimated_wrap_time}</div>
                    </div>
                  )}
                  {(callSheet.sunrise_time || callSheet.sunset_time) && (
                    <div className="flex gap-4">
                      {callSheet.sunrise_time && (
                        <div className="flex items-center gap-1">
                          <Sunrise className="w-4 h-4 text-orange-400" />
                          <span className="text-muted-gray">{callSheet.sunrise_time}</span>
                        </div>
                      )}
                      {callSheet.sunset_time && (
                        <div className="flex items-center gap-1">
                          <Sunset className="w-4 h-4 text-orange-500" />
                          <span className="text-muted-gray">{callSheet.sunset_time}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Locations */}
              {(displayLocations.length > 0 || callSheet.location_name) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-accent-yellow" />
                    Locations
                  </h4>
                  {displayLocations.length > 0 ? (
                    displayLocations.map((loc, i) => (
                      <div key={loc.id || i} className="bg-muted-gray/10 rounded-lg p-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-accent-yellow/30 text-accent-yellow">
                            Location {loc.location_number}
                          </Badge>
                          {loc.call_time && (
                            <span className="text-sm text-muted-gray">Call: {loc.call_time}</span>
                          )}
                        </div>
                        <div className="text-bone-white font-medium">{loc.name}</div>
                        {loc.address && (
                          <div className="text-sm text-muted-gray">{loc.address}</div>
                        )}
                        {loc.parking_instructions && (
                          <div className="flex items-start gap-2 text-sm">
                            <Car className="w-4 h-4 text-muted-gray mt-0.5" />
                            <span className="text-muted-gray">{loc.parking_instructions}</span>
                          </div>
                        )}
                        {loc.basecamp_location && (
                          <div className="flex items-start gap-2 text-sm">
                            <Building className="w-4 h-4 text-muted-gray mt-0.5" />
                            <span className="text-muted-gray">Basecamp: {loc.basecamp_location}</span>
                          </div>
                        )}
                        {/* Scout Photos Preview */}
                        {loc.location_id && (
                          <ScoutPreviewWidget
                            locationId={loc.location_id}
                            locationName={loc.name}
                            className="mt-3 pt-3 border-t border-muted-gray/20"
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="bg-muted-gray/10 rounded-lg p-4">
                      <div className="text-bone-white font-medium">{callSheet.location_name}</div>
                      {callSheet.location_address && (
                        <div className="text-sm text-muted-gray">{callSheet.location_address}</div>
                      )}
                      {callSheet.parking_notes && (
                        <div className="flex items-start gap-2 text-sm mt-2">
                          <Car className="w-4 h-4 text-muted-gray mt-0.5" />
                          <span className="text-muted-gray">{callSheet.parking_notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Schedule */}
              {callSheet.schedule_blocks && callSheet.schedule_blocks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-bone-white mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent-yellow" />
                    Day Schedule
                  </h4>
                  <div className="bg-muted-gray/10 rounded-lg overflow-hidden">
                    {callSheet.schedule_blocks.map((block, i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex gap-4 p-3 text-sm',
                          i % 2 === 0 ? 'bg-transparent' : 'bg-muted-gray/5'
                        )}
                      >
                        <span className="font-mono text-accent-yellow w-20 shrink-0">
                          {block.time}
                        </span>
                        <div className="flex-1">
                          <span className="text-bone-white">{block.activity}</span>
                          {block.notes && (
                            <span className="text-muted-gray ml-2">— {block.notes}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Weather */}
              {(callSheet.weather_forecast || callSheet.weather_info) && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-blue-400 mb-1 flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Weather
                  </h4>
                  <p className="text-sm text-blue-300">{callSheet.weather_forecast || callSheet.weather_info}</p>
                </div>
              )}

              {/* Department Notes */}
              {departmentNotes.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-bone-white mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent-yellow" />
                    Department Notes
                  </h4>
                  <Accordion type="multiple" className="space-y-2">
                    {departmentNotes.map((note) => (
                      <AccordionItem key={note.id} value={note.id} className="border border-muted-gray/30 rounded-lg px-4">
                        <AccordionTrigger className="text-bone-white hover:no-underline py-3">
                          <span className="flex items-center gap-2 text-sm">
                            {DEPARTMENT_ICONS[note.id] || <ChevronRight className="w-4 h-4" />}
                            {note.label}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="text-sm text-muted-gray pb-4 whitespace-pre-wrap">
                          {note.value}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              )}

              {/* Special Instructions */}
              {callSheet.special_instructions && (
                <div className="bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-accent-yellow mb-1">Special Instructions</h4>
                  <p className="text-sm text-bone-white whitespace-pre-wrap">
                    {callSheet.special_instructions}
                  </p>
                </div>
              )}

              {/* General Notes */}
              {callSheet.general_notes && (
                <div className="bg-muted-gray/10 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-bone-white mb-2">General Notes</h4>
                  <p className="text-sm text-muted-gray whitespace-pre-wrap">
                    {callSheet.general_notes}
                  </p>
                </div>
              )}

              {/* Safety Notes */}
              {callSheet.safety_notes && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-1 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Safety Notes
                  </h4>
                  <p className="text-sm text-red-300 whitespace-pre-wrap">{callSheet.safety_notes}</p>
                </div>
              )}

              {/* Hospital Info */}
              {(callSheet.nearest_hospital || callSheet.hospital_name || callSheet.hospital_address) && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
                    <Heart className="w-4 h-4" />
                    Nearest Hospital
                  </h4>
                  <div className="text-sm text-emerald-300 space-y-1">
                    {(callSheet.nearest_hospital || callSheet.hospital_name) && (
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        {callSheet.nearest_hospital || callSheet.hospital_name}
                      </div>
                    )}
                    {callSheet.hospital_address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        {callSheet.hospital_address}
                      </div>
                    )}
                    {callSheet.hospital_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {callSheet.hospital_phone}
                      </div>
                    )}
                    {callSheet.set_medic && (
                      <div className="flex items-center gap-2 pt-2 border-t border-emerald-500/30 mt-2">
                        <User className="w-4 h-4" />
                        Set Medic: {callSheet.set_medic}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Advance Schedule */}
              {callSheet.advance_schedule && (
                <div className="bg-muted-gray/10 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-bone-white mb-2">Tomorrow / Advance</h4>
                  <p className="text-sm text-muted-gray whitespace-pre-wrap">
                    {callSheet.advance_schedule}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Contacts Tab */}
            <TabsContent value="contacts" className="space-y-6">
              {/* Key Production Contacts */}
              {hasKeyContacts && (
                <div className="bg-muted-gray/10 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <Phone className="w-4 h-4 text-accent-yellow" />
                    Key Contacts
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {callSheet.production_office_phone && (
                      <div className="flex items-start gap-3">
                        <Building className="w-5 h-5 text-muted-gray mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-gray">Production Office</div>
                          <div className="text-bone-white">{callSheet.production_office_phone}</div>
                          {callSheet.production_email && (
                            <div className="text-sm text-muted-gray">{callSheet.production_email}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {callSheet.director_name && (
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-muted-gray mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-gray">Director</div>
                          <div className="text-bone-white">{callSheet.director_name}</div>
                          {callSheet.director_phone && (
                            <div className="text-sm text-muted-gray">{callSheet.director_phone}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {callSheet.producer_name && (
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-muted-gray mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-gray">Producer</div>
                          <div className="text-bone-white">{callSheet.producer_name}</div>
                          {callSheet.producer_phone && (
                            <div className="text-sm text-muted-gray">{callSheet.producer_phone}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {callSheet.first_ad_name && (
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-muted-gray mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-gray">1st AD</div>
                          <div className="text-bone-white">{callSheet.first_ad_name}</div>
                          {callSheet.first_ad_phone && (
                            <div className="text-sm text-muted-gray">{callSheet.first_ad_phone}</div>
                          )}
                        </div>
                      </div>
                    )}
                    {callSheet.upm_name && (
                      <div className="flex items-start gap-3">
                        <User className="w-5 h-5 text-muted-gray mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-gray">UPM / Line Producer</div>
                          <div className="text-bone-white">{callSheet.upm_name}</div>
                          {callSheet.upm_phone && (
                            <div className="text-sm text-muted-gray">{callSheet.upm_phone}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Legacy Production Contact */}
              {(callSheet.production_contact || callSheet.production_phone) && !hasKeyContacts && (
                <div className="bg-muted-gray/10 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-accent-yellow" />
                    Production Contact
                  </h4>
                  <div className="text-sm text-muted-gray">
                    {callSheet.production_contact}
                    {callSheet.production_phone && (
                      <span className="ml-3 text-bone-white">{callSheet.production_phone}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Custom Contacts */}
              {callSheet.custom_contacts && callSheet.custom_contacts.length > 0 && (
                <div className="bg-muted-gray/10 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-accent-yellow" />
                    Additional Contacts
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {callSheet.custom_contacts.map((contact, i) => (
                      <div key={contact.id || i} className="flex items-start gap-3">
                        <User className="w-5 h-5 text-muted-gray mt-0.5" />
                        <div>
                          <div className="text-xs text-muted-gray">{contact.title}</div>
                          <div className="text-bone-white">{contact.name}</div>
                          {contact.phone && (
                            <div className="text-sm text-muted-gray">{contact.phone}</div>
                          )}
                          {contact.email && (
                            <div className="text-sm text-muted-gray">{contact.email}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No contacts message */}
              {!hasKeyContacts && !callSheet.production_contact && (!callSheet.custom_contacts || callSheet.custom_contacts.length === 0) && (
                <div className="text-center py-12">
                  <Phone className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-bone-white mb-2">No contacts listed</h3>
                  <p className="text-muted-gray">
                    Add contacts when editing this call sheet.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* People Tab */}
            <TabsContent value="people" className="space-y-6">
              {peopleLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : people.length > 0 ? (
                <>
                  {/* Cast Section */}
                  {cast.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-accent-yellow mb-3 flex items-center gap-2">
                        <Film className="w-4 h-4" />
                        Cast
                        <Badge variant="outline" className="ml-2">
                          {cast.length}
                        </Badge>
                      </h4>
                      <div className="bg-muted-gray/10 rounded-lg overflow-hidden">
                        {cast.map((person, i) => (
                          <div
                            key={person.id}
                            className={cn(
                              'flex items-center gap-4 p-3',
                              i % 2 === 0 ? 'bg-transparent' : 'bg-muted-gray/5'
                            )}
                          >
                            <div className="w-10 h-10 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                              {person.cast_number ? (
                                <span className="text-accent-yellow font-bold">{person.cast_number}</span>
                              ) : (
                                <User className="w-5 h-5 text-accent-yellow" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-bone-white">{person.name}</span>
                                {person.character_name && (
                                  <span className="text-sm text-accent-yellow">as {person.character_name}</span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-muted-gray mt-1">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Call: {person.call_time}
                                </span>
                                {person.pickup_time && (
                                  <span>Pickup: {person.pickup_time}</span>
                                )}
                                {person.makeup_time && (
                                  <span>M/U: {person.makeup_time}</span>
                                )}
                                {person.on_set_time && (
                                  <span>On Set: {person.on_set_time}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Crew by Department */}
                  {Object.entries(peopleByDepartment)
                    .filter(([_, deptPeople]) => deptPeople.some(p => !p.is_cast))
                    .map(([department, deptPeople]) => (
                      <div key={department}>
                        <h4 className="text-sm font-medium text-accent-yellow mb-3 flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          {department}
                          <Badge variant="outline" className="ml-2">
                            {deptPeople.filter(p => !p.is_cast).length}
                          </Badge>
                        </h4>
                        <div className="bg-muted-gray/10 rounded-lg overflow-hidden">
                          {deptPeople.filter(p => !p.is_cast).map((person, i) => (
                            <div
                              key={person.id}
                              className={cn(
                                'flex items-center gap-4 p-3',
                                i % 2 === 0 ? 'bg-transparent' : 'bg-muted-gray/5'
                              )}
                            >
                              <div className="w-8 h-8 rounded-full bg-muted-gray/30 flex items-center justify-center">
                                <User className="w-4 h-4 text-muted-gray" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-bone-white">{person.name}</span>
                                  {person.role && (
                                    <span className="text-sm text-muted-gray">— {person.role}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-gray mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Call: {person.call_time}
                                  </span>
                                  {person.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-3 h-3" />
                                      {person.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-bone-white mb-2">No people listed</h3>
                  <p className="text-muted-gray">
                    Add people to this call sheet to list their call times and details.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Scenes Tab */}
            <TabsContent value="scenes" className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                  <Film className="w-4 h-4 text-accent-yellow" />
                  Linked Scenes
                </h4>
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSceneLinkModal(true)}
                    className="border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
                  >
                    <Film className="w-4 h-4 mr-2" />
                    Manage Scenes
                  </Button>
                )}
              </div>

              {linkedScenes && linkedScenes.length > 0 ? (
                <div className="space-y-2">
                  {linkedScenes
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((link, i) => (
                      <div
                        key={link.id}
                        className={cn(
                          'flex items-center gap-4 p-3 rounded-lg',
                          i % 2 === 0 ? 'bg-muted-gray/10' : 'bg-muted-gray/5'
                        )}
                      >
                        <div className="w-8 h-8 rounded bg-accent-yellow/20 flex items-center justify-center text-accent-yellow font-bold text-sm">
                          {link.sort_order}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs shrink-0">
                              {link.scene?.scene_number || 'Scene'}
                            </Badge>
                            {link.scene?.int_ext && (
                              <span className="text-xs text-muted-gray uppercase">
                                {link.scene.int_ext}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-bone-white font-medium truncate mt-1">
                            {link.scene?.scene_heading || link.scene?.location_name || 'Untitled Scene'}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-gray">
                            {link.scene?.estimated_duration && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {link.scene.estimated_duration}m
                              </span>
                            )}
                            {link.scene?.page_count && (
                              <span>{link.scene.page_count} pg</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Film className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-bone-white mb-2">No scenes linked</h3>
                  <p className="text-muted-gray mb-4">
                    Link scenes from the script breakdown to this call sheet.
                  </p>
                  {canEdit && (
                    <Button
                      onClick={() => setShowSceneLinkModal(true)}
                      className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                    >
                      <Film className="w-4 h-4 mr-2" />
                      Link Scenes
                    </Button>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Send History Tab */}
            <TabsContent value="history" className="space-y-4">
              {historyLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : sendHistory.length > 0 ? (
                sendHistory.map((send) => (
                  <div
                    key={send.id}
                    className="bg-muted-gray/10 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-accent-yellow" />
                        <span className="font-medium text-bone-white">
                          Sent to {send.recipient_count} recipient{send.recipient_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-sm text-muted-gray">
                        {formatDistanceToNow(new Date(send.sent_at), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-gray">
                      <Badge variant="outline" className="border-muted-gray/30">
                        {send.channel === 'email_and_notification'
                          ? 'Email & Notification'
                          : send.channel === 'email'
                          ? 'Email Only'
                          : 'Notification Only'}
                      </Badge>
                      {send.emails_sent > 0 && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {send.emails_sent} email{send.emails_sent !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {send.sent_by_name && (
                      <div className="text-xs text-muted-gray">
                        Sent by {send.sent_by_name}
                      </div>
                    )}
                    {send.message && (
                      <div className="text-sm text-muted-gray border-l-2 border-muted-gray/30 pl-3 mt-2">
                        "{send.message}"
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                  <History className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-bone-white mb-2">No send history</h3>
                  <p className="text-muted-gray">
                    This call sheet hasn't been sent to anyone yet.
                  </p>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Print-only content */}
        <div className="hidden print:block print:text-black">
          {/* Header with times */}
          <div className="mb-4 border-b pb-4">
            <div className="flex justify-between mb-2">
              <div>
                <strong>Crew Call:</strong> {callSheet.crew_call_time || callSheet.general_call_time || 'TBD'}
              </div>
              <div>
                <strong>First Shot:</strong> {callSheet.first_shot_time || 'TBD'}
              </div>
              <div>
                <strong>Est. Wrap:</strong> {callSheet.estimated_wrap_time || 'TBD'}
              </div>
            </div>
            {callSheet.location_name && (
              <div className="mt-2">
                <strong>Location:</strong> {callSheet.location_name}
                {callSheet.location_address && ` — ${callSheet.location_address}`}
              </div>
            )}
          </div>

          {/* Schedule */}
          {callSheet.schedule_blocks && callSheet.schedule_blocks.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Schedule</h3>
              <table className="w-full text-sm">
                <tbody>
                  {callSheet.schedule_blocks.map((block, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1 w-24 font-mono">{block.time}</td>
                      <td className="py-1">{block.activity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Cast */}
          {cast.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Cast</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b font-medium">
                    <td className="py-1">#</td>
                    <td className="py-1">Actor</td>
                    <td className="py-1">Character</td>
                    <td className="py-1">Call</td>
                    <td className="py-1">M/U</td>
                  </tr>
                </thead>
                <tbody>
                  {cast.map((person) => (
                    <tr key={person.id} className="border-b">
                      <td className="py-1">{person.cast_number || '-'}</td>
                      <td className="py-1">{person.name}</td>
                      <td className="py-1">{person.character_name || '-'}</td>
                      <td className="py-1">{person.call_time}</td>
                      <td className="py-1">{person.makeup_time || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Crew */}
          {crew.length > 0 && (
            <div className="mb-4">
              <h3 className="font-bold mb-2">Crew</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b font-medium">
                    <td className="py-1">Name</td>
                    <td className="py-1">Role</td>
                    <td className="py-1">Call</td>
                    <td className="py-1">Contact</td>
                  </tr>
                </thead>
                <tbody>
                  {crew.map((person) => (
                    <tr key={person.id} className="border-b">
                      <td className="py-1">{person.name}</td>
                      <td className="py-1">{person.role || '-'}</td>
                      <td className="py-1">{person.call_time}</td>
                      <td className="py-1">{person.phone || person.email || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Safety & Hospital */}
          {(callSheet.safety_notes || callSheet.hospital_name || callSheet.nearest_hospital) && (
            <div className="mt-4 pt-4 border-t">
              {callSheet.safety_notes && (
                <div className="mb-2">
                  <strong>Safety Notes:</strong> {callSheet.safety_notes}
                </div>
              )}
              {(callSheet.nearest_hospital || callSheet.hospital_name) && (
                <div>
                  <strong>Nearest Hospital:</strong> {callSheet.nearest_hospital || callSheet.hospital_name}
                  {callSheet.hospital_address && ` — ${callSheet.hospital_address}`}
                  {callSheet.hospital_phone && ` — ${callSheet.hospital_phone}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between mt-4 pt-4 border-t border-muted-gray/20 print:hidden">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePrint}
              className="border-muted-gray/30"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={downloadPdf.isPending}
              className="border-muted-gray/30"
            >
              {downloadPdf.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              PDF
            </Button>
            {canEdit && (
              <Button
                variant="outline"
                onClick={() => setShowSyncModal(true)}
                className="border-muted-gray/30"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Sync
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="border-muted-gray/30">
              Close
            </Button>
            {canEdit && (
              <Button
                onClick={onSend}
                className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              >
                <Mail className="w-4 h-4 mr-2" />
                Send to Team
              </Button>
            )}
          </div>
        </div>

        {/* Sync Modal */}
        <CallSheetSyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          callSheet={callSheet}
        />

        {/* Scene Link Modal */}
        <CallSheetSceneLinkModal
          isOpen={showSceneLinkModal}
          onClose={() => setShowSceneLinkModal(false)}
          callSheetId={callSheet.id}
          projectId={projectId}
          canEdit={canEdit}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CallSheetDetailView;
