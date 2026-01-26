/**
 * HotSetDayReportView - Detailed report view for a wrapped production day
 *
 * Shows:
 * - Day summary (call time, wrap time, total hours, OT)
 * - Projected vs Actual schedule comparison
 * - Scene-by-scene breakdown with timing data
 * - Schedule blocks (meals, moves, etc.)
 * - Export PDF functionality
 */
import React, { useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileDown,
  Clock,
  CheckCircle2,
  SkipForward,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Film,
  Coffee,
  Truck,
  Users,
  Target,
  Flag,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useHotSetDashboard,
  useWrapReport,
  formatElapsedTime,
  formatTime,
  formatScheduleTime,
  WrapReportData,
} from '@/hooks/backlot';
import { HotSetSession, ProjectedScheduleItem } from '@/types/backlot';
import { generateHotSetDayReportPdf } from './hot-set-day-report-pdf';

interface HotSetDayReportViewProps {
  session: HotSetSession;
  projectId: string;
  projectName?: string;
  onBack?: () => void;
  onResume?: () => void;
  isResuming?: boolean;
}

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'scene': return Film;
    case 'meal': return Coffee;
    case 'company_move': return Truck;
    case 'crew_call': return Users;
    case 'first_shot': return Target;
    case 'wrap': return Flag;
    default: return Activity;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case 'scene': return 'Scene';
    case 'meal': return 'Meal Break';
    case 'company_move': return 'Company Move';
    case 'crew_call': return 'Crew Call';
    case 'first_shot': return 'First Shot';
    case 'wrap': return 'Wrap';
    case 'activity': return 'Activity';
    default: return type.replace(/_/g, ' ');
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/30';
    case 'skipped': return 'text-red-400 bg-red-500/10 border-red-500/30';
    case 'in_progress': return 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30';
    default: return 'text-muted-gray bg-muted-gray/10 border-muted-gray/30';
  }
};

export const HotSetDayReportView: React.FC<HotSetDayReportViewProps> = ({
  session,
  projectId,
  projectName,
  onBack,
  onResume,
  isResuming,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = React.useState(false);

  // Fetch data
  const { data: dashboard } = useHotSetDashboard(session.id);
  const { data: wrapReport } = useWrapReport(session.id);

  const projectedSchedule = dashboard?.projected_schedule || [];

  // Calculate stats
  const completedItems = projectedSchedule.filter(i => i.status === 'completed');
  const skippedItems = projectedSchedule.filter(i => i.status === 'skipped');
  const totalItems = projectedSchedule.length;

  // Group items by type
  const scenes = projectedSchedule.filter(i => i.type === 'scene');
  const completedScenes = scenes.filter(i => i.status === 'completed');
  const skippedScenes = scenes.filter(i => i.status === 'skipped');

  // Calculate total variance
  const totalVariance = completedItems.reduce((sum, item) => {
    if (item.actual_duration_minutes && item.planned_duration_minutes) {
      return sum + (item.planned_duration_minutes - item.actual_duration_minutes);
    }
    return sum;
  }, 0);

  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      await generateHotSetDayReportPdf({
        session,
        wrapReport: wrapReport || null,
        projectedSchedule,
        projectName,
      });
    } catch (error) {
      console.error('Failed to export PDF:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const formatVariance = (minutes: number) => {
    if (minutes === 0) return 'On Schedule';
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    let timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    return minutes > 0 ? `${timeStr} Under` : `${timeStr} Over`;
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button variant="ghost" onClick={onBack} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
          )}
          <div>
            <h2 className="text-2xl font-bold text-bone-white">
              Day {(session as any).production_day?.day_number || (session as any).backlot_production_days?.day_number || '?'} Report
            </h2>
            <p className="text-muted-gray">
              {((session as any).production_day?.date || (session as any).backlot_production_days?.date) && new Date(((session as any).production_day?.date || (session as any).backlot_production_days?.date) + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onResume && session.status === 'wrapped' && (
            <Button
              variant="outline"
              onClick={onResume}
              disabled={isResuming}
              className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            >
              Resume Day
            </Button>
          )}
          <Button onClick={handleExportPdf} disabled={isExporting} className="gap-2 bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            <FileDown className="w-4 h-4" />
            {isExporting ? 'Exporting...' : 'Export PDF'}
          </Button>
        </div>
      </div>

      {/* Printable Report Content */}
      <div ref={reportRef} className="space-y-6 print:text-black print:bg-white">
        {/* Print Header */}
        <div className="hidden print:block text-center mb-8">
          <h1 className="text-3xl font-bold">Production Day Report</h1>
          <p className="text-lg">Day {(session as any).production_day?.day_number || (session as any).backlot_production_days?.day_number || '?'} - {(session as any).production_day?.date || (session as any).backlot_production_days?.date || ''}</p>
        </div>

        {/* Day Summary Card */}
        <Card className="bg-soft-black border-muted-gray/20 print:bg-white print:border-gray-300">
          <CardHeader className="border-b border-muted-gray/20 print:border-gray-300">
            <CardTitle className="flex items-center gap-2 text-bone-white print:text-black">
              <Calendar className="w-5 h-5" />
              Day Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs text-muted-gray uppercase mb-1 print:text-gray-600">Crew Call</p>
                <p className="text-2xl font-bold text-bone-white print:text-black">
                  {formatTime(session.actual_start_time, session.timezone) || wrapReport?.call_time || '--:--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-gray uppercase mb-1 print:text-gray-600">Wrap Time</p>
                <p className="text-2xl font-bold text-bone-white print:text-black">
                  {formatTime(session.actual_wrap_time, session.timezone) || wrapReport?.wrap_time || '--:--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-gray uppercase mb-1 print:text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold text-bone-white print:text-black">
                  {wrapReport?.total_shooting_minutes
                    ? formatElapsedTime(wrapReport.total_shooting_minutes)
                    : '--'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-gray uppercase mb-1 print:text-gray-600">Schedule Variance</p>
                <p className={cn(
                  'text-2xl font-bold',
                  totalVariance > 0 ? 'text-green-400 print:text-green-600' :
                  totalVariance < 0 ? 'text-red-400 print:text-red-600' :
                  'text-bone-white print:text-black'
                )}>
                  {formatVariance(totalVariance)}
                </p>
              </div>
            </div>

            {/* Scene summary */}
            <div className="mt-6 pt-6 border-t border-muted-gray/20 print:border-gray-300">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-3xl font-bold text-green-400 print:text-green-600">
                    {completedScenes.length}
                  </p>
                  <p className="text-sm text-muted-gray print:text-gray-600">Scenes Completed</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-red-400 print:text-red-600">
                    {skippedScenes.length}
                  </p>
                  <p className="text-sm text-muted-gray print:text-gray-600">Scenes Skipped</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-bone-white print:text-black">
                    {scenes.length}
                  </p>
                  <p className="text-sm text-muted-gray print:text-gray-600">Total Scenes</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Comparison */}
        <Card className="bg-soft-black border-muted-gray/20 print:bg-white print:border-gray-300">
          <CardHeader className="border-b border-muted-gray/20 print:border-gray-300">
            <CardTitle className="flex items-center gap-2 text-bone-white print:text-black">
              <Clock className="w-5 h-5" />
              Schedule Comparison (Planned vs Actual)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-charcoal-black/50 border-b border-muted-gray/20 text-xs font-medium text-muted-gray uppercase print:bg-gray-100 print:text-gray-700 print:border-gray-300">
              <div className="col-span-1">Type</div>
              <div className="col-span-3">Item</div>
              <div className="col-span-2 text-center">Planned Start</div>
              <div className="col-span-2 text-center">Actual Start</div>
              <div className="col-span-2 text-center">Duration</div>
              <div className="col-span-2 text-center">Variance</div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-muted-gray/10 print:divide-gray-200">
              {projectedSchedule.map((item, index) => {
                const TypeIcon = getTypeIcon(item.type);
                const variance = item.actual_duration_minutes && item.planned_duration_minutes
                  ? item.planned_duration_minutes - item.actual_duration_minutes
                  : 0;

                return (
                  <div
                    key={item.id || index}
                    className={cn(
                      'grid grid-cols-12 gap-2 px-4 py-3 items-center',
                      item.status === 'skipped' && 'opacity-50'
                    )}
                  >
                    <div className="col-span-1">
                      <TypeIcon className="w-4 h-4 text-muted-gray print:text-gray-500" />
                    </div>
                    <div className="col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-bone-white print:text-black">
                          {item.name}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn('text-xs', getStatusColor(item.status))}
                        >
                          {item.status === 'completed' ? 'Done' :
                           item.status === 'skipped' ? 'Skipped' :
                           item.status}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-gray truncate print:text-gray-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="col-span-2 text-center text-sm text-muted-gray print:text-gray-600">
                      {formatScheduleTime(item.planned_start_time, session.timezone)}
                    </div>
                    <div className="col-span-2 text-center text-sm text-bone-white print:text-black">
                      {item.actual_start_time
                        ? formatScheduleTime(item.actual_start_time, session.timezone)
                        : '--:--'}
                    </div>
                    <div className="col-span-2 text-center text-sm">
                      <span className="text-muted-gray print:text-gray-600">
                        {item.planned_duration_minutes}m
                      </span>
                      {item.actual_duration_minutes && (
                        <span className="text-bone-white print:text-black ml-2">
                          / {item.actual_duration_minutes}m
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 text-center">
                      {item.status === 'completed' && variance !== 0 ? (
                        <span className={cn(
                          'text-sm font-medium',
                          variance > 0 ? 'text-green-400 print:text-green-600' : 'text-red-400 print:text-red-600'
                        )}>
                          {variance > 0 ? '+' : ''}{variance}m
                        </span>
                      ) : item.status === 'completed' ? (
                        <span className="text-sm text-muted-gray print:text-gray-600">On Time</span>
                      ) : (
                        <span className="text-sm text-muted-gray print:text-gray-600">--</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {projectedSchedule.length === 0 && (
              <div className="p-8 text-center text-muted-gray print:text-gray-600">
                No schedule data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Completed Scenes Detail */}
        {wrapReport && wrapReport.scenes_completed.length > 0 && (
          <Card className="bg-soft-black border-muted-gray/20 print:bg-white print:border-gray-300">
            <CardHeader className="border-b border-muted-gray/20 print:border-gray-300">
              <CardTitle className="flex items-center gap-2 text-bone-white print:text-black">
                <CheckCircle2 className="w-5 h-5 text-green-400 print:text-green-600" />
                Completed Scenes ({wrapReport.scenes_completed.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                {wrapReport.scenes_completed.map((scene, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30 print:bg-green-50 print:border-green-300"
                  >
                    <span className="font-bold text-green-400 print:text-green-700">
                      {scene.scene_number}
                    </span>
                    <span className="text-sm text-green-400/70 ml-2 print:text-green-600">
                      {scene.actual_minutes}m
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Skipped Scenes */}
        {wrapReport && wrapReport.scenes_skipped.length > 0 && (
          <Card className="bg-soft-black border-muted-gray/20 print:bg-white print:border-gray-300">
            <CardHeader className="border-b border-muted-gray/20 print:border-gray-300">
              <CardTitle className="flex items-center gap-2 text-bone-white print:text-black">
                <SkipForward className="w-5 h-5 text-red-400 print:text-red-600" />
                Skipped Scenes ({wrapReport.scenes_skipped.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3">
                {wrapReport.scenes_skipped.map((scene, idx) => (
                  <div
                    key={idx}
                    className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 print:bg-red-50 print:border-red-300"
                  >
                    <span className="font-bold text-red-400 print:text-red-700">
                      {scene.scene_number}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Time Markers */}
        {wrapReport && wrapReport.markers.length > 0 && (
          <Card className="bg-soft-black border-muted-gray/20 print:bg-white print:border-gray-300">
            <CardHeader className="border-b border-muted-gray/20 print:border-gray-300">
              <CardTitle className="flex items-center gap-2 text-bone-white print:text-black">
                <Flag className="w-5 h-5 text-blue-400 print:text-blue-600" />
                Time Markers
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {wrapReport.markers.map((marker, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-2 border-b border-muted-gray/10 last:border-0 print:border-gray-200"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-xs capitalize">
                        {marker.type.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-bone-white print:text-black">{marker.label}</span>
                    </div>
                    <span className="font-mono text-muted-gray print:text-gray-600">{marker.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* AD Notes */}
        {wrapReport?.ad_notes && (
          <Card className="bg-soft-black border-muted-gray/20 print:bg-white print:border-gray-300">
            <CardHeader className="border-b border-muted-gray/20 print:border-gray-300">
              <CardTitle className="text-bone-white print:text-black">AD Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-muted-gray whitespace-pre-wrap print:text-gray-700">
                {wrapReport.ad_notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Print Footer */}
        <div className="hidden print:block text-center text-sm text-gray-500 mt-8 pt-4 border-t border-gray-300">
          <p>Generated from Second Watch Network - Hot Set</p>
          <p>Printed on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HotSetDayReportView;
