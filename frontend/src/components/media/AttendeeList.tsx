import { useState } from 'react';
import { UserPlus, X, Check, HelpCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const RSVP_ICONS: Record<string, { icon: any; color: string }> = {
  invited: { icon: Clock, color: 'text-slate-400' },
  accepted: { icon: Check, color: 'text-green-400' },
  declined: { icon: XCircle, color: 'text-red-400' },
  maybe: { icon: HelpCircle, color: 'text-amber-400' },
  attended: { icon: Check, color: 'text-emerald-400' },
};

interface AttendeeListProps {
  attendees: any[];
  isTeam: boolean;
  onAdd?: (profileId: string, role?: string) => void;
  onRemove?: (profileId: string) => void;
  onUpdateRole?: (profileId: string, role: string) => void;
}

const AttendeeList = ({ attendees, isTeam, onAdd, onRemove }: AttendeeListProps) => {
  const [showAddInput, setShowAddInput] = useState(false);
  const [addProfileId, setAddProfileId] = useState('');
  const [addRole, setAddRole] = useState('');

  const handleAdd = () => {
    if (!addProfileId.trim()) return;
    onAdd?.(addProfileId.trim(), addRole.trim() || undefined);
    setAddProfileId('');
    setAddRole('');
    setShowAddInput(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-bone-white">
          Attendees ({attendees.length})
        </h3>
        {isTeam && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAddInput(!showAddInput)}
            className="text-accent-yellow hover:text-accent-yellow/80 text-xs"
          >
            <UserPlus className="h-3 w-3 mr-1" /> Add
          </Button>
        )}
      </div>

      {showAddInput && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-gray">Profile ID</label>
            <input
              type="text" value={addProfileId}
              onChange={e => setAddProfileId(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
              placeholder="UUID..."
            />
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-gray">Role</label>
            <input
              type="text" value={addRole}
              onChange={e => setAddRole(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-xs"
              placeholder="e.g. camera op"
            />
          </div>
          <Button size="sm" onClick={handleAdd} className="bg-accent-yellow text-charcoal-black text-xs h-8">
            Add
          </Button>
        </div>
      )}

      {attendees.length === 0 ? (
        <p className="text-xs text-muted-gray py-2">No attendees yet</p>
      ) : (
        <div className="space-y-2">
          {attendees.map((att: any) => {
            const rsvp = RSVP_ICONS[att.rsvp_status] || RSVP_ICONS.invited;
            const RsvpIcon = rsvp.icon;
            return (
              <div
                key={att.id}
                className="flex items-center justify-between p-2 rounded bg-muted-gray/10 border border-muted-gray/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <RsvpIcon className={`h-4 w-4 flex-shrink-0 ${rsvp.color}`} />
                  <div className="min-w-0">
                    <span className="text-sm text-bone-white truncate block">
                      {att.profile_name || 'Unknown'}
                    </span>
                    {att.role && (
                      <span className="text-xs text-muted-gray">{att.role}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-gray capitalize">{att.rsvp_status}</span>
                  {isTeam && onRemove && (
                    <button
                      onClick={() => onRemove(att.profile_id)}
                      className="text-muted-gray hover:text-red-400 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AttendeeList;
