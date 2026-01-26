/**
 * CreateHotSetSessionModal - Modal for creating a new Hot Set session
 *
 * Features:
 * - Select production day (with inline creation option)
 * - Day type selection with OT threshold descriptions
 * - Real-time OT cost preview
 * - Crew preview from DOOD/Call Sheet
 * - Import source options (Hour Schedule, Call Sheet, Start Fresh)
 * - Configure tracking mode
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Clock,
  Film,
  FileText,
  Loader2,
  Coffee,
  Truck,
  Target,
  ListOrdered,
  GitBranch,
  Users,
  DollarSign,
  AlertTriangle,
  MapPin,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import {
  BacklotProductionDay,
  BacklotCallSheet,
  HotSetDayType,
  HotSetScheduleTrackingMode,
  HourScheduleBlock,
} from '@/types/backlot';
import {
  formatScheduleTime,
  formatCurrency,
  useHotSetDayPreview,
  OT_THRESHOLDS,
} from '@/hooks/backlot/useHotSet';

interface CreateHotSetSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productionDays: BacklotProductionDay[];
  callSheets: BacklotCallSheet[];
  projectId: string;
  onSubmit: (data: {
    production_day_id: string;
    call_sheet_id?: string;
    day_type: HotSetDayType;
    import_hour_schedule: boolean;
    import_scenes: boolean;
    schedule_tracking_mode: HotSetScheduleTrackingMode;
    auto_start?: boolean;
    auto_start_minutes?: number;
  }) => Promise<void>;
  onCreateProductionDay?: () => void;
  defaultAutoStart?: boolean;
  autoStartMinutes?: number;
  isLoading?: boolean;
}

// Block type icons
const blockTypeIcons: Record<string, React.ReactNode> = {
  scene: <Film className="w-3 h-3" />,
  meal: <Coffee className="w-3 h-3" />,
  company_move: <Truck className="w-3 h-3" />,
  activity: <Target className="w-3 h-3" />,
  crew_call: <Clock className="w-3 h-3" />,
  first_shot: <Film className="w-3 h-3" />,
  wrap: <Clock className="w-3 h-3" />,
};

// Block type colors
const blockTypeColors: Record<string, string> = {
  scene: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  meal: 'bg-green-500/20 text-green-400 border-green-500/30',
  company_move: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  activity: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  crew_call: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
  first_shot: 'bg-primary-red/20 text-primary-red border-primary-red/30',
  wrap: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
};

// All day type options
const DAY_TYPE_OPTIONS: HotSetDayType[] = ['4hr', '8hr', '10hr', '12hr', '6th_day', '7th_day'];

export const CreateHotSetSessionModal: React.FC<CreateHotSetSessionModalProps> = ({
  open,
  onOpenChange,
  productionDays,
  callSheets,
  projectId,
  onSubmit,
  onCreateProductionDay,
  defaultAutoStart = true,
  autoStartMinutes = 30,
  isLoading,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string>('');
  const [dayType, setDayType] = useState<HotSetDayType>('10hr');
  const [importHourSchedule, setImportHourSchedule] = useState<boolean>(true);
  const [importScenes, setImportScenes] = useState<boolean>(true);
  const [trackingMode, setTrackingMode] = useState<HotSetScheduleTrackingMode>('auto_reorder');
  const [selectedCallSheetId, setSelectedCallSheetId] = useState<string>('');
  const [autoStart, setAutoStart] = useState<boolean>(defaultAutoStart);
  const [autoStartMinutesBefore, setAutoStartMinutesBefore] = useState<number>(autoStartMinutes);

  // Fetch day preview data
  const { data: dayPreview, isLoading: isLoadingPreview } = useHotSetDayPreview(
    projectId,
    selectedDayId || null,
    dayType
  );

  // Get selected day
  const selectedDay = useMemo(() => {
    return productionDays.find((d) => d.id === selectedDayId);
  }, [productionDays, selectedDayId]);

  // Get hour schedule from selected day
  const hourSchedule = useMemo(() => {
    return (selectedDay?.hour_schedule || []) as HourScheduleBlock[];
  }, [selectedDay]);

  // Check if day has hour schedule
  const hasHourSchedule = hourSchedule.length > 0;

  // Check if day has assigned scenes (from production day scenes)
  const hasProductionDayScenes = (selectedDay as any)?.scene_count > 0 || false;

  // Get call sheets for selected day
  const dayCallSheets = useMemo(() => {
    if (!selectedDay) return [];
    return callSheets.filter(
      (cs) => cs.date === selectedDay.date || cs.production_day_id === selectedDayId
    );
  }, [callSheets, selectedDay, selectedDayId]);

  // Reset when day changes
  const handleDayChange = (dayId: string) => {
    setSelectedDayId(dayId);
    setSelectedCallSheetId('');
    // Default checkboxes based on what's available
    const day = productionDays.find((d) => d.id === dayId);
    const schedule = (day?.hour_schedule || []) as HourScheduleBlock[];
    setImportHourSchedule(schedule.length > 0);
    setImportScenes(true);
  };

  const handleSubmit = async () => {
    if (!selectedDayId) return;

    await onSubmit({
      production_day_id: selectedDayId,
      call_sheet_id: importScenes && selectedCallSheetId ? selectedCallSheetId : undefined,
      day_type: dayType,
      import_hour_schedule: importHourSchedule,
      import_scenes: importScenes,
      schedule_tracking_mode: trackingMode,
      auto_start: autoStart,
      auto_start_minutes: autoStart ? autoStartMinutesBefore : undefined,
    });

    // Reset form
    setSelectedDayId('');
    setSelectedCallSheetId('');
    setDayType('10hr');
    setImportHourSchedule(true);
    setImportScenes(true);
    setTrackingMode('auto_reorder');
    setAutoStart(defaultAutoStart);
    setAutoStartMinutesBefore(autoStartMinutes);
  };

  // Count blocks by type
  const blockCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const block of hourSchedule) {
      counts[block.type] = (counts[block.type] || 0) + 1;
    }
    return counts;
  }, [hourSchedule]);

  // Get current OT threshold config
  const otConfig = OT_THRESHOLDS[dayType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Create Hot Set Session</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Set up real-time tracking for a production day with OT cost projections
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Production Day Selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">Production Day</Label>
            <div className="flex gap-2">
              <Select value={selectedDayId} onValueChange={handleDayChange}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30 flex-1">
                  <SelectValue placeholder="Select a production day" />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/30">
                  {productionDays.map((day) => (
                    <SelectItem key={day.id} value={day.id}>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-gray" />
                        <span>Day {day.day_number}</span>
                        <span className="text-muted-gray">
                          {parseLocalDate(day.date).toLocaleDateString()}
                        </span>
                        {day.title && (
                          <span className="text-muted-gray truncate max-w-[150px]">
                            - {day.title}
                          </span>
                        )}
                        {((day.hour_schedule || []) as HourScheduleBlock[]).length > 0 && (
                          <Badge variant="outline" className="text-xs ml-auto">
                            Schedule
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {onCreateProductionDay && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onCreateProductionDay}
                  className="border-muted-gray/30"
                  title="Create new production day"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Day Info Card (when day selected) */}
          {selectedDay && (
            <Card className="bg-soft-black border-muted-gray/30">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 text-sm">
                  {selectedDay.general_call_time && (
                    <div className="flex items-center gap-2 text-muted-gray">
                      <Clock className="w-4 h-4" />
                      <span>Call: {selectedDay.general_call_time}</span>
                    </div>
                  )}
                  {selectedDay.location_name && (
                    <div className="flex items-center gap-2 text-muted-gray">
                      <MapPin className="w-4 h-4" />
                      <span>{selectedDay.location_name}</span>
                    </div>
                  )}
                  {dayPreview?.expected_hours && (
                    <div className="flex items-center gap-2 text-muted-gray">
                      <Clock className="w-4 h-4" />
                      <span>
                        Expected: {dayPreview.expected_hours.total_hours.toFixed(1)} hours
                        {dayPreview.expected_hours.call_time && dayPreview.expected_hours.wrap_time && (
                          <span className="text-muted-gray/70">
                            {' '}({formatScheduleTime(dayPreview.expected_hours.call_time)} - {formatScheduleTime(dayPreview.expected_hours.wrap_time)})
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Day Type Selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">Day Type</Label>
            <Select value={dayType} onValueChange={(v) => setDayType(v as HotSetDayType)}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/30">
                {DAY_TYPE_OPTIONS.map((type) => {
                  const config = OT_THRESHOLDS[type];
                  return (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        <span className="text-muted-gray text-xs">({config.desc})</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {/* OT threshold note */}
            {dayPreview?.expected_hours && dayPreview.expected_hours.total_hours > otConfig.ot1_after && (
              <p className="text-sm text-amber-400 mt-1">
                {dayType === '7th_day' ? (
                  `All ${dayPreview.expected_hours.total_hours.toFixed(1)} hours at Double Time (Sunday rules)`
                ) : (
                  `${(dayPreview.expected_hours.total_hours - otConfig.ot1_after).toFixed(1)} hours of OT expected at scheduled wrap`
                )}
              </p>
            )}
          </div>

          {/* OT Preview Section (when day selected) */}
          {selectedDayId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Crew Preview */}
              <Card className="bg-soft-black border-muted-gray/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-bone-white">
                    <Users className="w-4 h-4" />
                    Crew Working
                    {dayPreview && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        {dayPreview.crew.length} people
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingPreview ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                    </div>
                  ) : dayPreview && dayPreview.crew.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-muted-gray/20">
                            <TableHead className="text-muted-gray text-xs">Name</TableHead>
                            <TableHead className="text-muted-gray text-xs">Dept</TableHead>
                            <TableHead className="text-muted-gray text-xs text-right">Rate</TableHead>
                            <TableHead className="text-muted-gray text-xs text-right">
                              {dayPreview.expected_hours.total_hours.toFixed(0)}hr Cost
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dayPreview.crew.slice(0, 15).map((person) => (
                            <TableRow key={person.id} className="border-muted-gray/10">
                              <TableCell className="py-1">
                                <div className="flex items-center gap-1">
                                  <span className="text-bone-white text-xs truncate max-w-[120px]">
                                    {person.name}
                                  </span>
                                  {person.source === 'dood' && (
                                    <Badge className="text-[10px] px-1 py-0 bg-blue-500/20 text-blue-400">D</Badge>
                                  )}
                                  {person.source === 'call_sheet' && (
                                    <Badge className="text-[10px] px-1 py-0 bg-green-500/20 text-green-400">CS</Badge>
                                  )}
                                  {person.source === 'both' && (
                                    <Badge className="text-[10px] px-1 py-0 bg-purple-500/20 text-purple-400">B</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-1 text-xs text-muted-gray truncate max-w-[80px]">
                                {person.department || person.role || '-'}
                              </TableCell>
                              <TableCell className="py-1 text-xs text-right">
                                {person.has_rate ? (
                                  <span className="text-bone-white">
                                    ${person.rate_amount?.toFixed(0)}/{person.rate_type === 'hourly' ? 'hr' : person.rate_type === 'daily' ? 'day' : person.rate_type === 'weekly' ? 'wk' : 'flat'}
                                  </span>
                                ) : (
                                  <span className="text-muted-gray">--</span>
                                )}
                              </TableCell>
                              <TableCell className="py-1 text-xs text-right">
                                {person.projected_cost !== null ? (
                                  <span className="text-bone-white">${person.projected_cost.toFixed(0)}</span>
                                ) : (
                                  <span className="text-amber-400 flex items-center justify-end gap-1">
                                    <AlertTriangle className="w-3 h-3" />
                                    --
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {dayPreview.crew.length > 15 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-xs text-muted-gray py-2">
                                + {dayPreview.crew.length - 15} more crew members
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-gray text-sm">
                      No crew found for this day.
                      <br />
                      <span className="text-xs">Add people via DOOD or Call Sheet</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cost Projection */}
              <Card className="bg-soft-black border-muted-gray/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-bone-white">
                    <DollarSign className="w-4 h-4" />
                    Projected Costs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoadingPreview ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
                    </div>
                  ) : dayPreview?.ot_projection ? (
                    <div className="space-y-3">
                      {/* Hours breakdown */}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center p-2 rounded bg-charcoal-black">
                          <div className="text-muted-gray text-xs">Regular</div>
                          <div className="text-bone-white font-medium">
                            {dayPreview.ot_projection.regular_hours.toFixed(1)}hr
                          </div>
                        </div>
                        <div className="text-center p-2 rounded bg-amber-500/10">
                          <div className="text-amber-400 text-xs">OT @ 1.5x</div>
                          <div className="text-bone-white font-medium">
                            {dayPreview.ot_projection.ot1_hours.toFixed(1)}hr
                          </div>
                        </div>
                        <div className="text-center p-2 rounded bg-red-500/10">
                          <div className="text-red-400 text-xs">DT @ 2x</div>
                          <div className="text-bone-white font-medium">
                            {dayPreview.ot_projection.ot2_hours.toFixed(1)}hr
                          </div>
                        </div>
                      </div>

                      {/* Cost breakdown */}
                      <div className="space-y-1 text-sm border-t border-muted-gray/20 pt-3">
                        <div className="flex justify-between text-muted-gray">
                          <span>Regular ({dayPreview.ot_projection.regular_hours.toFixed(1)}hr):</span>
                          <span className="text-bone-white">{formatCurrency(dayPreview.ot_projection.total_regular_cost)}</span>
                        </div>
                        {dayPreview.ot_projection.ot1_hours > 0 && (
                          <div className="flex justify-between text-amber-400">
                            <span>OT @ 1.5x ({dayPreview.ot_projection.ot1_hours.toFixed(1)}hr):</span>
                            <span>{formatCurrency(dayPreview.ot_projection.total_ot1_cost)}</span>
                          </div>
                        )}
                        {dayPreview.ot_projection.ot2_hours > 0 && (
                          <div className="flex justify-between text-red-400">
                            <span>Double Time ({dayPreview.ot_projection.ot2_hours.toFixed(1)}hr):</span>
                            <span>{formatCurrency(dayPreview.ot_projection.total_ot2_cost)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-medium text-bone-white border-t border-muted-gray/20 pt-2 mt-2">
                          <span>TOTAL:</span>
                          <span>{formatCurrency(dayPreview.ot_projection.total_cost)}</span>
                        </div>
                      </div>

                      {/* Warning for missing rates */}
                      {dayPreview.ot_projection.crew_without_rates > 0 && (
                        <div className="flex items-center gap-2 p-2 rounded bg-amber-500/10 text-amber-400 text-xs">
                          <AlertTriangle className="w-4 h-4" />
                          <span>
                            {dayPreview.ot_projection.crew_without_rates} crew member
                            {dayPreview.ot_projection.crew_without_rates > 1 ? 's have' : ' has'} no rate configured
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-gray text-sm">
                      Select a day to see cost projections
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Import Options Selection */}
          {selectedDayId && (
            <div className="space-y-3">
              <Label className="text-bone-white">Import Options</Label>
              <p className="text-sm text-muted-gray">
                Select what to import into this session. You can select both, either, or neither.
              </p>
              <div className="space-y-2">
                {/* Hour Schedule Checkbox */}
                <div
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    importHourSchedule
                      ? 'border-accent-yellow/50 bg-accent-yellow/5'
                      : 'border-muted-gray/30 bg-soft-black hover:border-muted-gray/50',
                    !hasHourSchedule && 'opacity-50 cursor-not-allowed'
                  )}
                  onClick={() => hasHourSchedule && setImportHourSchedule(!importHourSchedule)}
                >
                  <Checkbox
                    checked={importHourSchedule}
                    onCheckedChange={(checked) => hasHourSchedule && setImportHourSchedule(checked as boolean)}
                    disabled={!hasHourSchedule}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-accent-yellow" />
                      <span className="font-medium text-bone-white">Import Hour Schedule</span>
                      {hasHourSchedule && (
                        <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-gray mt-1">
                      {hasHourSchedule
                        ? 'Import expected times, meals, and activities'
                        : 'No hour schedule configured for this day'}
                    </p>
                  </div>
                </div>

                {/* Scenes Checkbox */}
                <div
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    importScenes
                      ? 'border-accent-yellow/50 bg-accent-yellow/5'
                      : 'border-muted-gray/30 bg-soft-black hover:border-muted-gray/50'
                  )}
                  onClick={() => setImportScenes(!importScenes)}
                >
                  <Checkbox
                    checked={importScenes}
                    onCheckedChange={(checked) => setImportScenes(checked as boolean)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-bone-white">Import Scenes</span>
                    </div>
                    <p className="text-sm text-muted-gray mt-1">
                      {dayCallSheets.length > 0
                        ? 'Import scenes from call sheet'
                        : 'Import scenes assigned to this production day'}
                    </p>
                  </div>
                </div>
              </div>
              {!importHourSchedule && !importScenes && (
                <p className="text-sm text-muted-gray italic">
                  Starting fresh - add scenes manually after creation
                </p>
              )}
            </div>
          )}

          {/* Call Sheet Selection (when scenes import selected) */}
          {importScenes && dayCallSheets.length > 0 && (
            <div className="space-y-2">
              <Label className="text-bone-white">Select Call Sheet</Label>
              <Select value={selectedCallSheetId} onValueChange={setSelectedCallSheetId}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select a call sheet" />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-black border-muted-gray/30">
                  {dayCallSheets.map((cs) => (
                    <SelectItem key={cs.id} value={cs.id}>
                      {cs.title || `Call Sheet - ${cs.date}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Schedule Preview (when hour_schedule selected and has schedule) */}
          {importHourSchedule && hasHourSchedule && (
            <div className="space-y-3">
              <Label className="text-bone-white">Schedule Preview</Label>
              <Card className="bg-soft-black border-muted-gray/30">
                <CardContent className="p-4">
                  {/* Block counts summary */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {Object.entries(blockCounts).map(([type, count]) => (
                      <Badge
                        key={type}
                        variant="outline"
                        className={cn('text-xs', blockTypeColors[type])}
                      >
                        {blockTypeIcons[type]}
                        <span className="ml-1">
                          {count} {type === 'scene' ? 'Scene' : type.replace('_', ' ')}
                          {count > 1 ? 's' : ''}
                        </span>
                      </Badge>
                    ))}
                  </div>

                  {/* Schedule blocks preview (limited) */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {hourSchedule.slice(0, 10).map((block) => (
                      <div
                        key={block.id}
                        className="flex items-center gap-2 text-sm py-1 border-b border-muted-gray/10 last:border-0"
                      >
                        <span className="text-muted-gray w-20 font-mono text-xs">
                          {formatScheduleTime(block.start_time)}
                        </span>
                        <span className={cn('w-4 h-4', blockTypeColors[block.type])}>
                          {blockTypeIcons[block.type]}
                        </span>
                        <span className="text-bone-white truncate flex-1">
                          {block.type === 'scene'
                            ? `Scene ${block.scene_number || ''} - ${block.scene_slugline || ''}`
                            : block.activity_name ||
                              block.type.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </span>
                        <span className="text-muted-gray text-xs">{block.duration_minutes}m</span>
                      </div>
                    ))}
                    {hourSchedule.length > 10 && (
                      <div className="text-center text-sm text-muted-gray py-2">
                        + {hourSchedule.length - 10} more blocks
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tracking Mode (only shown when hour_schedule selected) */}
          {importHourSchedule && hasHourSchedule && (
            <div className="space-y-3">
              <Label className="text-bone-white">Schedule Tracking Mode</Label>
              <RadioGroup
                value={trackingMode}
                onValueChange={(v) => setTrackingMode(v as HotSetScheduleTrackingMode)}
                className="space-y-2"
              >
                <div
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    trackingMode === 'auto_reorder'
                      ? 'border-accent-yellow/50 bg-accent-yellow/5'
                      : 'border-muted-gray/30 bg-soft-black hover:border-muted-gray/50'
                  )}
                  onClick={() => setTrackingMode('auto_reorder')}
                >
                  <RadioGroupItem value="auto_reorder" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-green-400" />
                      <span className="font-medium text-bone-white">Auto-Reorder</span>
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                        Recommended
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-gray mt-1">
                      Automatically adjust expected times when scenes complete out of order
                    </p>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                    trackingMode === 'track_deviation'
                      ? 'border-accent-yellow/50 bg-accent-yellow/5'
                      : 'border-muted-gray/30 bg-soft-black hover:border-muted-gray/50'
                  )}
                  onClick={() => setTrackingMode('track_deviation')}
                >
                  <RadioGroupItem value="track_deviation" className="mt-1" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-bone-white">Track Deviation</span>
                    </div>
                    <p className="text-sm text-muted-gray mt-1">
                      Keep original schedule fixed, track deviation from plan
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Auto-Start Configuration */}
          {selectedDay && selectedDay.general_call_time && (
            <div className="space-y-3">
              <Label className="text-bone-white">Auto-Start Configuration</Label>
              <div
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  autoStart
                    ? 'border-accent-yellow/50 bg-accent-yellow/5'
                    : 'border-muted-gray/30 bg-soft-black hover:border-muted-gray/50'
                )}
                onClick={() => setAutoStart(!autoStart)}
              >
                <Checkbox
                  checked={autoStart}
                  onCheckedChange={(checked) => setAutoStart(checked as boolean)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-accent-yellow" />
                    <span className="font-medium text-bone-white">Auto-Start Session at Crew Call</span>
                    <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-gray mt-1">
                    Session automatically activates before crew call, showing countdown and prep checklist
                  </p>
                </div>
              </div>

              {/* Minutes before crew call input */}
              {autoStart && (
                <div className="pl-11 space-y-2">
                  <Label htmlFor="auto-start-minutes" className="text-sm text-bone-white">
                    Start session (minutes before crew call)
                  </Label>
                  <Input
                    id="auto-start-minutes"
                    type="number"
                    min="5"
                    max="120"
                    value={autoStartMinutesBefore}
                    onChange={(e) => setAutoStartMinutesBefore(parseInt(e.target.value) || 30)}
                    className="w-32 bg-charcoal-black border-muted-gray/30"
                  />
                  <p className="text-xs text-muted-gray">
                    Session will activate {autoStartMinutesBefore} minutes before {selectedDay.general_call_time}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-muted-gray/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedDayId || isLoading}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateHotSetSessionModal;
