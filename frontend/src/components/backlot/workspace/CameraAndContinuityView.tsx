/**
 * CameraAndContinuityView - Main view for Camera & Continuity tools
 * Contains 4 sub-tabs: Shot List, Slate Logger, Media Tracker, Continuity Notes
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Camera,
  Clapperboard,
  HardDrive,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/dateUtils';
import { useProductionDays } from '@/hooks/backlot';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Sub-tab components
import ShotListSubView from './camera-continuity/ShotListSubView';
import SlateLoggerSubView from './camera-continuity/SlateLoggerSubView';
import MediaTrackerSubView from './camera-continuity/MediaTrackerSubView';
import ContinuityNotesSubView from './camera-continuity/ContinuityNotesSubView';

interface CameraAndContinuityViewProps {
  projectId: string;
  canEdit: boolean;
}

type SubTab = 'shot-list' | 'slate-logger' | 'media-tracker' | 'continuity-notes';

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'shot-list', label: 'Shot List', icon: Camera },
  { id: 'slate-logger', label: 'Slate Logger', icon: Clapperboard },
  { id: 'media-tracker', label: 'Media Tracker', icon: HardDrive },
  { id: 'continuity-notes', label: 'Continuity Notes', icon: FileText },
];

const CameraAndContinuityView: React.FC<CameraAndContinuityViewProps> = ({
  projectId,
  canEdit,
}) => {
  const [activeTab, setActiveTab] = useState<SubTab>('shot-list');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Load production days for filtering
  const { data: productionDays, isLoading: daysLoading } = useProductionDays(projectId);

  // Auto-select first day if none selected
  React.useEffect(() => {
    if (!selectedDayId && productionDays && productionDays.length > 0) {
      // Try to find today's day, or the most recent past day, or the next upcoming day
      const today = new Date().toISOString().split('T')[0];
      const todayDay = productionDays.find(d => d.date === today);
      if (todayDay) {
        setSelectedDayId(todayDay.id);
      } else {
        // Find the most recent past day or first upcoming day
        const sortedDays = [...productionDays].sort((a, b) =>
          parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
        );
        const pastDays = sortedDays.filter(d => d.date < today);
        if (pastDays.length > 0) {
          setSelectedDayId(pastDays[pastDays.length - 1].id);
        } else {
          setSelectedDayId(sortedDays[0]?.id || null);
        }
      }
    }
  }, [selectedDayId, productionDays]);

  const selectedDay = productionDays?.find(d => d.id === selectedDayId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading text-bone-white">Camera & Continuity</h2>
          <p className="text-muted-gray text-sm">
            Track shots, slates, camera media, and continuity notes
          </p>
        </div>

        {/* Production Day Selector */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-gray">Shoot Day:</span>
          <Select
            value={selectedDayId || ''}
            onValueChange={(value) => setSelectedDayId(value || null)}
          >
            <SelectTrigger className="w-48 bg-soft-black border-muted-gray/30">
              <SelectValue placeholder={daysLoading ? "Loading..." : "Select day"} />
            </SelectTrigger>
            <SelectContent>
              {productionDays?.map((day) => (
                <SelectItem key={day.id} value={day.id}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Day {day.day_number}</span>
                    <span className="text-muted-gray text-xs">
                      {parseLocalDate(day.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDay && (
            <Badge variant="outline" className="border-muted-gray/30">
              {selectedDay.status === 'completed' ? 'Wrapped' :
               selectedDay.status === 'in_progress' ? 'Shooting' : 'Scheduled'}
            </Badge>
          )}
        </div>
      </div>

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SubTab)}>
        <TabsList className="bg-soft-black border border-muted-gray/20 p-1">
          {SUB_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(
                'flex items-center gap-2 data-[state=active]:bg-accent-yellow/10 data-[state=active]:text-accent-yellow'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="shot-list" className="mt-6">
          <ShotListSubView
            projectId={projectId}
            productionDayId={selectedDayId}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="slate-logger" className="mt-6">
          <SlateLoggerSubView
            projectId={projectId}
            productionDayId={selectedDayId}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="media-tracker" className="mt-6">
          <MediaTrackerSubView
            projectId={projectId}
            productionDayId={selectedDayId}
            canEdit={canEdit}
          />
        </TabsContent>

        <TabsContent value="continuity-notes" className="mt-6">
          <ContinuityNotesSubView
            projectId={projectId}
            productionDayId={selectedDayId}
            canEdit={canEdit}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CameraAndContinuityView;
