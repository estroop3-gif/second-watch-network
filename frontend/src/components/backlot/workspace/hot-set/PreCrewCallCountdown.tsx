/**
 * PreCrewCallCountdown - Displayed before crew call when session is auto-started
 *
 * Features:
 * - Countdown to crew call time
 * - Pre-shoot preparation checklist
 * - Confirm Crew Call button (1st AD manually confirms arrival)
 * - Confirm First Shot button (1st AD confirms cameras rolling)
 */
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Clock,
  Users,
  Clapperboard,
  CheckCircle2,
  AlertCircle,
  Camera,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { HotSetSession } from '@/types/backlot';

interface PreCrewCallCountdownProps {
  session: HotSetSession;
  crewCallTime: Date;
  onConfirmCrewCall: () => void;
  onConfirmFirstShot: () => void;
  isConfirmingCrewCall?: boolean;
  isConfirmingFirstShot?: boolean;
  className?: string;
}

interface PrepChecklistItem {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
}

const DEFAULT_CHECKLIST: Omit<PrepChecklistItem, 'checked'>[] = [
  { id: 'camera', label: 'Camera & Equipment Ready', description: 'Camera, lenses, and grip ready' },
  { id: 'lighting', label: 'Lighting Set', description: 'Key, fill, and back lights positioned' },
  { id: 'sound', label: 'Sound Check Complete', description: 'Mics tested and levels set' },
  { id: 'blocking', label: 'Blocking Rehearsed', description: 'Actors know their marks' },
  { id: 'safety', label: 'Safety Briefing Done', description: 'Crew aware of hazards' },
];

function calculateTimeRemaining(targetTime: Date): {
  hours: number;
  minutes: number;
  seconds: number;
  isPast: boolean;
} {
  const now = new Date();
  const diff = targetTime.getTime() - now.getTime();
  const isPast = diff < 0;
  const absDiff = Math.abs(diff);

  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((absDiff % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, isPast };
}

export const PreCrewCallCountdown: React.FC<PreCrewCallCountdownProps> = ({
  session,
  crewCallTime,
  onConfirmCrewCall,
  onConfirmFirstShot,
  isConfirmingCrewCall = false,
  isConfirmingFirstShot = false,
  className,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining(crewCallTime));
  const [checklist, setChecklist] = useState<PrepChecklistItem[]>(
    DEFAULT_CHECKLIST.map(item => ({ ...item, checked: false }))
  );

  const crewCallConfirmed = !!session.crew_call_confirmed_at;
  const firstShotConfirmed = !!session.first_shot_confirmed_at;

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining(calculateTimeRemaining(crewCallTime));
    }, 1000);

    return () => clearInterval(interval);
  }, [crewCallTime]);

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev =>
      prev.map(item => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const checklistComplete = checklist.every(item => item.checked);
  const { hours, minutes, seconds, isPast } = timeRemaining;

  // Format time for display
  const formattedCrewCallTime = crewCallTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Countdown Card */}
      <Card className="border-primary-red/30 bg-soft-black">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary-red" />
              {crewCallConfirmed ? 'Crew Call Confirmed' : 'Crew Call Countdown'}
            </CardTitle>
            <Badge variant={isPast ? 'destructive' : 'outline'} className="text-sm">
              {crewCallConfirmed ? 'Active' : isPast ? 'Crew Call Time!' : 'Countdown'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Time Display */}
          <div className="text-center">
            <div className="text-sm text-muted-gray mb-2">
              {crewCallConfirmed ? 'Crew Call Confirmed At' : 'Crew Call At'}
            </div>
            <div className="text-2xl font-bold text-bone-white mb-4">
              {formattedCrewCallTime}
            </div>

            {!crewCallConfirmed && (
              <>
                {isPast ? (
                  <div className="flex items-center justify-center gap-2 text-primary-red">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-lg font-semibold">Crew call time has passed</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="font-mono text-5xl font-bold text-bone-white">
                        {hours.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-muted-gray mt-1">Hours</div>
                    </div>
                    <div className="text-4xl text-muted-gray">:</div>
                    <div className="text-center">
                      <div className="font-mono text-5xl font-bold text-bone-white">
                        {minutes.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-muted-gray mt-1">Minutes</div>
                    </div>
                    <div className="text-4xl text-muted-gray">:</div>
                    <div className="text-center">
                      <div className="font-mono text-5xl font-bold text-bone-white">
                        {seconds.toString().padStart(2, '0')}
                      </div>
                      <div className="text-xs text-muted-gray mt-1">Seconds</div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Crew Call Confirmation */}
          {!crewCallConfirmed && (
            <div className="pt-4 border-t border-muted-gray/20">
              <Button
                onClick={onConfirmCrewCall}
                disabled={isConfirmingCrewCall}
                className="w-full bg-primary-red hover:bg-primary-red/90 text-white"
                size="lg"
              >
                <Users className="mr-2 h-5 w-5" />
                {isConfirmingCrewCall ? 'Confirming...' : 'Confirm Crew Call'}
              </Button>
              <p className="text-xs text-muted-gray text-center mt-2">
                Click when crew has arrived and is ready to work
              </p>
            </div>
          )}

          {/* First Shot Confirmation (shown after crew call confirmed) */}
          {crewCallConfirmed && !firstShotConfirmed && (
            <div className="pt-4 border-t border-muted-gray/20">
              <Button
                onClick={onConfirmFirstShot}
                disabled={isConfirmingFirstShot || !checklistComplete}
                className="w-full bg-accent-yellow hover:bg-accent-yellow/90 text-charcoal-black"
                size="lg"
              >
                <Camera className="mr-2 h-5 w-5" />
                {isConfirmingFirstShot ? 'Confirming...' : 'Confirm First Shot'}
              </Button>
              <p className="text-xs text-muted-gray text-center mt-2">
                {checklistComplete
                  ? 'Click when cameras are rolling on first shot'
                  : 'Complete prep checklist to enable'}
              </p>
            </div>
          )}

          {/* Success State */}
          {firstShotConfirmed && (
            <div className="pt-4 border-t border-muted-gray/20 text-center">
              <div className="inline-flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-semibold">First Shot Confirmed - Day Tracking Active</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prep Checklist (shown after crew call confirmed, before first shot) */}
      {crewCallConfirmed && !firstShotConfirmed && (
        <Card className="border-muted-gray/20 bg-soft-black">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5 text-accent-yellow" />
              Pre-Shoot Checklist
              <Badge variant="outline" className="ml-auto">
                {checklist.filter(i => i.checked).length} / {checklist.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map(item => (
              <div
                key={item.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-charcoal-black/50 transition-colors cursor-pointer"
                onClick={() => toggleChecklistItem(item.id)}
              >
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => toggleChecklistItem(item.id)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div
                    className={cn(
                      'font-medium transition-colors',
                      item.checked ? 'text-muted-gray line-through' : 'text-bone-white'
                    )}
                  >
                    {item.label}
                  </div>
                  {item.description && (
                    <div className="text-xs text-muted-gray mt-1">{item.description}</div>
                  )}
                </div>
              </div>
            ))}

            {checklistComplete && (
              <div className="pt-3 border-t border-muted-gray/20">
                <div className="flex items-center gap-2 text-green-400 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>All prep items complete. Ready for first shot!</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
