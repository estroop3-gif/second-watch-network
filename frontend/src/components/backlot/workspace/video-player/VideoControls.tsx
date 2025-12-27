/**
 * VideoControls - Control bar container with auto-hide functionality
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

// Quality options
const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1080p', label: '1080p HD' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
  { value: 'original', label: 'Original' },
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
}) => {
  const { state, actions } = useVideoPlayer();

  const handleQualityChange = (newQuality: QualityValue) => {
    onQualityChange?.(newQuality);
  };

  return (
    <div
      className={cn(
        'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-2 px-3 transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      )}
    >
      {/* Timeline */}
      <TimelineControl
        notes={notes}
        onNoteClick={onNoteClick}
        duration={clip?.duration_seconds || state.duration}
      />

      {/* Control Bar */}
      <div className="flex items-center gap-2 mt-2">
        {/* Left: Play/Pause and Shuttle */}
        <PlaybackControls />

        {/* Center: Timecode */}
        <div className="flex-1 flex justify-center">
          <TimecodeDisplay quality={actualQuality} />
        </div>

        {/* Right: Volume, Settings, Fullscreen */}
        <div className="flex items-center gap-1">
          {/* Loop Toggle */}
          <button
            onClick={actions.toggleLoop}
            className={cn(
              'p-2 rounded hover:bg-white/10 transition-colors',
              state.isLooping ? 'text-accent-yellow' : 'text-bone-white/70'
            )}
            title={state.isLooping ? 'Disable loop' : 'Enable loop'}
          >
            <Repeat className="w-4 h-4" />
          </button>

          {/* Volume */}
          <VolumeControl />

          {/* Settings Dropdown */}
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className="p-2 rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white relative z-10"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent align="end" className="w-52 z-[100]" sideOffset={8}>
                {/* Quality Settings */}
                <DropdownMenuLabel>Quality</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {QUALITY_OPTIONS.map((option) => {
                  const isAvailable = option.value === 'auto' || option.value === 'original' || availableRenditions.includes(option.value);
                  const isSelected = quality === option.value;
                  const isActual = actualQuality === option.value;

                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => handleQualityChange(option.value)}
                      className={cn(
                        "cursor-pointer flex items-center justify-between",
                        !isAvailable && "opacity-50"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {option.label}
                        {!isAvailable && (
                          <span className="text-xs text-muted-gray">(N/A)</span>
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
          <FullscreenButton />
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
