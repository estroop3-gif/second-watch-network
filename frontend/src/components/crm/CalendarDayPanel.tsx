import { Phone, Mail, MessageSquare, Users, Monitor, CalendarCheck, FileText, StickyNote, Pencil, Trash2, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { parseLocalDate } from '@/lib/dateUtils';

const ACTIVITY_ICONS: Record<string, any> = {
  call: Phone, email: Mail, text: MessageSquare,
  meeting: Users, demo: Monitor, follow_up: CalendarCheck,
  proposal_sent: FileText, note: StickyNote,
};

const TYPE_LABELS: Record<string, string> = {
  call: 'Call', email: 'Email', text: 'Text',
  meeting: 'Meeting', demo: 'Demo', follow_up: 'Follow Up',
  proposal_sent: 'Proposal Sent', note: 'Note', other: 'Other',
};

interface CalendarDayPanelProps {
  dateKey: string;
  activities: any[];
  followUps: any[];
  onClose: () => void;
  onLogActivity: () => void;
  onEditActivity: (activity: any) => void;
  onDeleteActivity: (id: string) => void;
  onCompleteFollowUp: (followUp: any) => void;
}

const CalendarDayPanel = ({
  dateKey, activities, followUps,
  onClose, onLogActivity, onEditActivity, onDeleteActivity, onCompleteFollowUp,
}: CalendarDayPanelProps) => {
  const date = parseLocalDate(dateKey);
  const formatted = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="w-full lg:w-[380px] flex-shrink-0 bg-charcoal-black border border-muted-gray/30 rounded-lg overflow-hidden flex flex-col max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
        <h3 className="text-sm font-medium text-bone-white">{formatted}</h3>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Activities Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-gray uppercase tracking-wider">Activities ({activities.length})</h4>
            <Button size="sm" variant="ghost" onClick={onLogActivity} className="text-accent-yellow text-xs h-7">
              + Log Activity
            </Button>
          </div>
          {activities.length === 0 ? (
            <p className="text-xs text-muted-gray">No activities logged</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a: any) => {
                const Icon = ACTIVITY_ICONS[a.activity_type] || StickyNote;
                return (
                  <Card key={a.id} className="bg-muted-gray/10 border-muted-gray/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <Icon className="h-4 w-4 mt-0.5 text-accent-yellow flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-bone-white truncate">
                            {TYPE_LABELS[a.activity_type] || a.activity_type}
                          </div>
                          <div className="text-xs text-muted-gray truncate">
                            {a.contact_first_name} {a.contact_last_name}
                          </div>
                          {a.subject && (
                            <div className="text-xs text-bone-white/60 mt-1 truncate">{a.subject}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEditActivity(a)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => onDeleteActivity(a.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Follow-ups Section */}
        {followUps.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-gray uppercase tracking-wider mb-2">
              Follow-ups ({followUps.length})
            </h4>
            <div className="space-y-2">
              {followUps.map((fu: any) => (
                <Card key={`fu-${fu.id}`} className="bg-blue-950/30 border-blue-500/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <CalendarCheck className="h-4 w-4 mt-0.5 text-blue-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-bone-white truncate">
                          {fu.contact_first_name} {fu.contact_last_name}
                        </div>
                        {fu.follow_up_notes && (
                          <div className="text-xs text-bone-white/60 mt-1">{fu.follow_up_notes}</div>
                        )}
                        {fu.subject && (
                          <div className="text-xs text-muted-gray mt-0.5">Re: {fu.subject}</div>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-blue-400 hover:text-blue-300 text-xs h-7 flex-shrink-0"
                      onClick={() => onCompleteFollowUp(fu)}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Complete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarDayPanel;
