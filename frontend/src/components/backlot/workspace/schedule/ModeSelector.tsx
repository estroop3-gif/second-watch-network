/**
 * ModeSelector - Production mode selection for hour schedule wizard
 *
 * Allows users to choose between:
 * - Scripted: Traditional scene-based scheduling
 * - Non-Scripted: Segment-based scheduling (documentaries, reality, corporate)
 * - Mixed: Combination of scenes and segments
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { HourScheduleMode } from '@/types/backlot';
import { Film, Video, Layers } from 'lucide-react';

interface ModeSelectorProps {
  selectedMode: HourScheduleMode;
  onModeChange: (mode: HourScheduleMode) => void;
  sceneCount: number;
  className?: string;
}

interface ModeCardProps {
  mode: HourScheduleMode;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const ModeCard: React.FC<ModeCardProps> = ({
  title,
  description,
  icon,
  badge,
  isSelected,
  onClick,
  disabled,
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={cn(
      'flex flex-col items-center p-6 rounded-lg border-2 transition-all text-center',
      'hover:border-accent-yellow/60',
      isSelected
        ? 'border-accent-yellow bg-accent-yellow/10'
        : 'border-muted-gray/30 bg-charcoal-black/50',
      disabled && 'opacity-50 cursor-not-allowed hover:border-muted-gray/30'
    )}
  >
    <div
      className={cn(
        'p-4 rounded-full mb-3',
        isSelected ? 'bg-accent-yellow/20 text-accent-yellow' : 'bg-muted-gray/20 text-muted-gray'
      )}
    >
      {icon}
    </div>
    <h3 className="font-medium text-bone-white mb-1">{title}</h3>
    <p className="text-xs text-muted-gray mb-2">{description}</p>
    {badge && (
      <Badge variant="outline" className="text-xs">
        {badge}
      </Badge>
    )}
  </button>
);

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  selectedMode,
  onModeChange,
  sceneCount,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-medium text-bone-white">Choose Production Type</h3>
        <p className="text-sm text-muted-gray">
          Select the type of content you're scheduling for this production day
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ModeCard
          mode="scripted"
          title="Scripted"
          description="Traditional scene-based production"
          icon={<Film className="w-8 h-8" />}
          badge={sceneCount > 0 ? `${sceneCount} scenes assigned` : undefined}
          isSelected={selectedMode === 'scripted'}
          onClick={() => onModeChange('scripted')}
        />

        <ModeCard
          mode="non_scripted"
          title="Non-Scripted"
          description="Documentary, reality TV, corporate"
          icon={<Video className="w-8 h-8" />}
          isSelected={selectedMode === 'non_scripted'}
          onClick={() => onModeChange('non_scripted')}
        />

        <ModeCard
          mode="mixed"
          title="Mixed"
          description="Combine scenes and segments"
          icon={<Layers className="w-8 h-8" />}
          badge={sceneCount > 0 ? `${sceneCount} scenes + segments` : undefined}
          isSelected={selectedMode === 'mixed'}
          onClick={() => onModeChange('mixed')}
        />
      </div>

      {selectedMode === 'scripted' && sceneCount === 0 && (
        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
          <p className="text-sm text-orange-400">
            No scenes assigned to this day. Assign scenes in the Schedule tab or choose Non-Scripted mode.
          </p>
        </div>
      )}

      {selectedMode === 'non_scripted' && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center">
          <p className="text-sm text-blue-400">
            Create a schedule using preset segments like interviews, B-roll, and talent prep.
          </p>
        </div>
      )}

      {selectedMode === 'mixed' && (
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
          <p className="text-sm text-purple-400">
            Combine scripted scenes with non-scripted segments in a single schedule.
          </p>
        </div>
      )}
    </div>
  );
};

export default ModeSelector;
