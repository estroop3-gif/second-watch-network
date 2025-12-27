/**
 * VideoControls - Control bar container with auto-hide functionality
 * Optimized for both horizontal and vertical video formats
 */
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useVideoPlayer } from './VideoPlayerContext';
import PlaybackControls from './PlaybackControls';
import VolumeControl from './VolumeControl';
import TimecodeDisplay from './TimecodeDisplay';
import FullscreenButton from './FullscreenButton';
import TimelineControl from './TimelineControl';
import { BacklotDailiesClip, BacklotDailiesClipNote } from '@/types/backlot';
import {
  Repeat,
  Settings,
  Check,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';

// Quality options (4K shown only when available)
const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '4k', label: '4K Ultra HD' },
  { value: '1080p', label: '1080p HD' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
] as const;

type QualityValue = typeof QUALITY_OPTIONS[number]['value'];

interface VideoControlsProps {
  visible: boolean;
  notes?: BacklotDailiesClipNote[];
  onNoteClick?: (note: BacklotDailiesClipNote) => void;
  clip?: BacklotDailiesClip;
  onQualityChange?: (quality: QualityValue) => void;
  quality?: QualityValue;
  actualQuality?: string;
  availableRenditions?: string[];
  isVertical?: boolean;
}

const VideoControls: React.FC<VideoControlsProps> = ({
  visible,
  notes = [],
  onNoteClick,
  clip,
  onQualityChange,
  quality = 'auto',
  actualQuality = 'original',
  availableRenditions = ['original'],
  isVertical = false,
}) => {
  const { state, actions } = useVideoPlayer();

  const handleQualityChange = (newQuality: QualityValue) => {
    onQualityChange?.(newQuality);
  };

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300',
        // Adjust padding for vertical videos (more compact)
        isVertical ? 'pt-8 pb-2 px-2' : 'pt-16 pb-2 px-3',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Timeline */}
      <TimelineControl
        notes={notes}
        onNoteClick={onNoteClick}
        duration={clip?.duration_seconds || state.duration}
        compact={isVertical}
      />

      {/* Control Bar */}
      <div className={cn(
        'flex items-center mt-2',
        // For vertical videos, use a more compact layout
        isVertical ? 'gap-1 flex-wrap justify-center' : 'gap-2'
      )}>
        {/* Left: Play/Pause and Shuttle */}
        <PlaybackControls compact={isVertical} />

        {/* Center: Timecode - hide on very narrow vertical */}
        <div className={cn(
          'flex justify-center',
          isVertical ? 'order-last w-full mt-1' : 'flex-1'
        )}>
          <TimecodeDisplay quality={actualQuality} compact={isVertical} />
        </div>

        {/* Right: Volume, Settings, Fullscreen */}
        <div className={cn(
          'flex items-center',
          isVertical ? 'gap-0.5' : 'gap-1'
        )}>
          {/* Loop Toggle */}
          <button
            onClick={actions.toggleLoop}
            className={cn(
              'rounded hover:bg-white/10 transition-colors',
              isVertical ? 'p-1.5' : 'p-2',
              state.isLooping ? 'text-accent-yellow' : 'text-bone-white/70'
            )}
            title={state.isLooping ? 'Disable loop' : 'Enable loop'}
          >
            <Repeat className={cn(isVertical ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          </button>

          {/* Volume - hide on vertical to save space, accessible via settings */}
          {!isVertical && <VolumeControl />}

          {/* Settings Dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  'rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white relative z-10',
                  isVertical ? 'p-1.5' : 'p-2'
                )}
                title="Settings"
              >
                <Settings className={cn(isVertical ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent align="end" className="w-52 z-[100]" sideOffset={8}>
                {/* Quality Settings */}
                <DropdownMenuLabel>Quality</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUALITY_OPTIONS
                  // Only show 4K option if it's available
                  .filter((option) => option.value !== '4k' || availableRenditions.includes('4k'))
                  .map((option) => {
                    // auto is always available, others check availableRenditions
                    const isAvailable = option.value === 'auto' || availableRenditions.includes(option.value);
                    const isSelected = quality === option.value;
                    const isActual = actualQuality === option.value;

                    return (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => isAvailable && handleQualityChange(option.value)}
                        className={cn(
                          "cursor-pointer flex items-center justify-between",
                          !isAvailable && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {option.label}
                          {!isAvailable && (
                            <span className="text-xs text-muted-gray">(Processing)</span>
                          )}
                        </span>
                        {isSelected && (
                          <Check className={cn(
                            "w-4 h-4",
                            isActual ? "text-accent-yellow" : "text-muted-gray"
                          )} />
                        )}
                      </DropdownMenuItem>
                    );
                  })}

                <DropdownMenuSeparator />

                {/* Volume (for vertical videos where it's hidden) */}
                {isVertical && (
                  <>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger className="cursor-pointer">
                        Volume ({Math.round(state.volume * 100)}%)
                      </DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent className="z-[101]">
                          {[100, 75, 50, 25, 0].map((vol) => (
                            <DropdownMenuItem
                              key={vol}
                              onClick={() => actions.setVolume(vol / 100)}
                              className="cursor-pointer flex items-center justify-between"
                            >
                              <span>{vol}%</span>
                              {Math.round(state.volume * 100) === vol && (
                                <Check className="w-4 h-4 text-accent-yellow" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSeparator />
                  </>
                )}

                {/* Playback Speed */}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="cursor-pointer">
                    Playback Speed ({state.playbackRate}x)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuPortal>
                    <DropdownMenuSubContent className="z-[101]">
                      {state.availableSpeeds.map((speed) => (
                        <DropdownMenuItem
                          key={speed}
                          onClick={() => actions.setPlaybackRate(speed)}
                          className="cursor-pointer flex items-center justify-between"
                        >
                          <span>{speed}x</span>
                          {state.playbackRate === speed && (
                            <Check className="w-4 h-4 text-accent-yellow" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuPortal>
                </DropdownMenuSub>

                <DropdownMenuSeparator />

                {/* In/Out Points */}
                <DropdownMenuLabel>In/Out Points</DropdownMenuLabel>
                <DropdownMenuItem onClick={actions.setInPoint} className="cursor-pointer">
                  Set In Point (I)
                  {state.inPoint !== null && (
                    <span className="ml-auto text-xs text-muted-gray">
                      {formatTime(state.inPoint)}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={actions.setOutPoint} className="cursor-pointer">
                  Set Out Point (O)
                  {state.outPoint !== null && (
                    <span className="ml-auto text-xs text-muted-gray">
                      {formatTime(state.outPoint)}
                    </span>
                  )}
                </DropdownMenuItem>
                {(state.inPoint !== null || state.outPoint !== null) && (
                  <DropdownMenuItem onClick={actions.clearInOutPoints} className="cursor-pointer text-red-400">
                    Clear In/Out
                  </DropdownMenuItem>
                )}

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => actions.setShowShortcutOverlay(true)}
                  className="cursor-pointer"
                >
                  Keyboard Shortcuts (?)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenu>

          {/* Fullscreen */}
          <FullscreenButton compact={isVertical} />
        </div>
      </div>
    </div>
  );
};

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default VideoControls;
