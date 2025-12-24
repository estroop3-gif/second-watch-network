/**
 * AutoSchedulerWizard - AI-powered schedule generation wizard
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Wand2,
  Loader2,
  Check,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Film,
  FileText,
  MapPin,
  Sun,
  Moon,
} from 'lucide-react';
import {
  useAutoGenerateSchedule,
  useApplyScheduleSuggestion,
  AutoSchedulerConstraints,
  SuggestedDay,
} from '@/hooks/backlot';
import { format, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface AutoSchedulerWizardProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type WizardStep = 'configure' | 'preview' | 'apply';

export const AutoSchedulerWizard: React.FC<AutoSchedulerWizardProps> = ({
  projectId,
  isOpen,
  onClose,
  onComplete,
}) => {
  const [step, setStep] = useState<WizardStep>('configure');
  const [constraints, setConstraints] = useState<AutoSchedulerConstraints>({
    max_pages_per_day: 5,
    group_by_location: true,
    group_by_int_ext: true,
    group_by_time_of_day: true,
    target_days: null,
  });
  const [suggestions, setSuggestions] = useState<SuggestedDay[]>([]);
  const [startDate, setStartDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));

  const generateSchedule = useAutoGenerateSchedule(projectId);
  const applySchedule = useApplyScheduleSuggestion(projectId);

  const handleGenerate = async () => {
    try {
      const result = await generateSchedule.mutateAsync({ constraints });
      setSuggestions(result.suggested_days);
      setStep('preview');
    } catch (err) {
      console.error('Failed to generate schedule:', err);
    }
  };

  const handleApply = async () => {
    try {
      await applySchedule.mutateAsync({
        suggested_days: suggestions,
        start_date: startDate,
      });
      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to apply schedule:', err);
    }
  };

  const handleClose = () => {
    setStep('configure');
    setSuggestions([]);
    onClose();
  };

  const totalPages = suggestions.reduce((sum, d) => sum + d.total_pages, 0);
  const totalScenes = suggestions.reduce((sum, d) => sum + d.scenes.length, 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-accent-yellow" />
            Auto-Schedule Wizard
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 py-2 border-b border-muted-gray/20">
          <StepIndicator
            number={1}
            label="Configure"
            active={step === 'configure'}
            completed={step !== 'configure'}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray" />
          <StepIndicator
            number={2}
            label="Preview"
            active={step === 'preview'}
            completed={step === 'apply'}
          />
          <ChevronRight className="w-4 h-4 text-muted-gray" />
          <StepIndicator
            number={3}
            label="Apply"
            active={step === 'apply'}
            completed={false}
          />
        </div>

        {/* Step Content */}
        <ScrollArea className="h-[400px]">
          {step === 'configure' && (
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-gray">
                Configure how the scheduler should group your scenes into production days.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="max_pages">Maximum pages per day</Label>
                  <Input
                    id="max_pages"
                    type="number"
                    min={1}
                    max={20}
                    step={0.5}
                    value={constraints.max_pages_per_day}
                    onChange={(e) =>
                      setConstraints({
                        ...constraints,
                        max_pages_per_day: parseFloat(e.target.value) || 5,
                      })
                    }
                  />
                  <p className="text-xs text-muted-gray">
                    Typical: 3-5 pages for drama, 5-8 for comedy
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Grouping Options</Label>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="group_location"
                      checked={constraints.group_by_location}
                      onCheckedChange={(checked) =>
                        setConstraints({ ...constraints, group_by_location: !!checked })
                      }
                    />
                    <label htmlFor="group_location" className="text-sm">
                      Group by location (minimize company moves)
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="group_int_ext"
                      checked={constraints.group_by_int_ext}
                      onCheckedChange={(checked) =>
                        setConstraints({ ...constraints, group_by_int_ext: !!checked })
                      }
                    />
                    <label htmlFor="group_int_ext" className="text-sm">
                      Group by INT/EXT
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="group_tod"
                      checked={constraints.group_by_time_of_day}
                      onCheckedChange={(checked) =>
                        setConstraints({ ...constraints, group_by_time_of_day: !!checked })
                      }
                    />
                    <label htmlFor="group_tod" className="text-sm">
                      Group by time of day (DAY/NIGHT)
                    </label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="target_days">Target number of days (optional)</Label>
                  <Input
                    id="target_days"
                    type="number"
                    min={1}
                    placeholder="Auto-calculate"
                    value={constraints.target_days || ''}
                    onChange={(e) =>
                      setConstraints({
                        ...constraints,
                        target_days: e.target.value ? parseInt(e.target.value) : null,
                      })
                    }
                  />
                  <p className="text-xs text-muted-gray">
                    Leave empty to auto-calculate based on page limits
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-gray">
                      Suggested schedule: {suggestions.length} days, {totalScenes} scenes, {totalPages.toFixed(1)} pages
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setStep('configure')}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Reconfigure
                  </Button>
                </div>

                <div className="space-y-3">
                  {suggestions.map((day) => (
                    <div
                      key={day.day_number}
                      className="border border-muted-gray/20 rounded-lg p-3 bg-charcoal-black/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-accent-yellow">
                            Day {day.day_number}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            <Film className="w-3 h-3 mr-1" />
                            {day.scenes.length}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            {day.total_pages.toFixed(1)} pgs
                          </Badge>
                        </div>
                        {day.reasoning && (
                          <span className="text-xs text-muted-gray">
                            {day.reasoning}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {day.scenes.map((scene) => (
                          <div
                            key={scene.id}
                            className="text-xs px-2 py-1 bg-muted-gray/10 rounded flex items-center gap-1"
                          >
                            <span className="font-medium text-bone-white">
                              {scene.scene_number}
                            </span>
                            {scene.int_ext && (
                              <span className="text-muted-gray">
                                {scene.int_ext === 'INT' ? (
                                  <Moon className="w-3 h-3 inline" />
                                ) : (
                                  <Sun className="w-3 h-3 inline" />
                                )}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>

                      {day.locations.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-muted-gray">
                          <MapPin className="w-3 h-3" />
                          {day.locations.slice(0, 3).join(', ')}
                          {day.locations.length > 3 && ` +${day.locations.length - 3}`}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
            </div>
          )}

          {step === 'apply' && (
            <div className="space-y-4 p-4">
              <p className="text-sm text-muted-gray">
                Choose when to start the schedule. Days will be created consecutively.
              </p>

              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-sm text-blue-400">
                  <Check className="w-4 h-4 inline mr-2" />
                  This will create {suggestions.length} production days and assign {totalScenes} scenes.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-muted-gray/20 pt-4">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>

          {step === 'configure' && (
            <Button
              onClick={handleGenerate}
              disabled={generateSchedule.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {generateSchedule.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" />
                  Generate Schedule
                </>
              )}
            </Button>
          )}

          {step === 'preview' && (
            <Button
              onClick={() => setStep('apply')}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Continue to Apply
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {step === 'apply' && (
            <Button
              onClick={handleApply}
              disabled={applySchedule.isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {applySchedule.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Apply Schedule
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const StepIndicator: React.FC<{
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}> = ({ number, label, active, completed }) => (
  <div className="flex items-center gap-2">
    <div
      className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
        active
          ? 'bg-accent-yellow text-charcoal-black'
          : completed
          ? 'bg-green-500 text-white'
          : 'bg-muted-gray/20 text-muted-gray'
      )}
    >
      {completed ? <Check className="w-3 h-3" /> : number}
    </div>
    <span
      className={cn(
        'text-sm',
        active ? 'text-bone-white font-medium' : 'text-muted-gray'
      )}
    >
      {label}
    </span>
  </div>
);

export default AutoSchedulerWizard;
