/**
 * VolumeControl - Volume slider with mute toggle (vertical popup)
 */
import React, { useState } from 'react';
import { useVideoPlayer } from './VideoPlayerContext';
import { cn } from '@/lib/utils';
import { Volume2, Volume1, VolumeX } from 'lucide-react';

const VolumeControl: React.FC = () => {
  const { state, actions } = useVideoPlayer();
  const [showSlider, setShowSlider] = useState(false);

  const getVolumeIcon = () => {
    if (state.isMuted || state.volume === 0) {
      return <VolumeX className="w-4 h-4" />;
    }
    if (state.volume < 0.5) {
      return <Volume1 className="w-4 h-4" />;
    }
    return <Volume2 className="w-4 h-4" />;
  };

  const volumePercent = state.isMuted ? 0 : state.volume * 100;

  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    // Calculate from bottom (0%) to top (100%)
    const clickY = rect.bottom - e.clientY;
    const percentage = Math.max(0, Math.min(100, (clickY / rect.height) * 100));
    actions.setVolume(percentage / 100);
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      {/* Volume Slider Popup */}
      <div
        className={cn(
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 transition-all duration-200',
          showSlider ? 'opacity-100 visible' : 'opacity-0 invisible'
        )}
      >
        <div className="bg-charcoal-gray rounded-lg p-2 shadow-xl border border-white/10" style={{ backgroundColor: '#1a1a1a' }}>
          {/* Vertical slider track */}
          <div
            className="relative w-8 h-24 flex justify-center cursor-pointer"
            onClick={handleSliderClick}
          >
            {/* Track background */}
            <div className="w-1 h-full bg-white/20 rounded-full relative">
              {/* Fill */}
              <div
                className="absolute bottom-0 left-0 right-0 bg-accent-yellow rounded-full transition-all"
                style={{ height: `${volumePercent}%` }}
              />
              {/* Thumb */}
              <div
                className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-accent-yellow rounded-full shadow-lg"
                style={{ bottom: `calc(${volumePercent}% - 6px)` }}
              />
            </div>
          </div>
          {/* Volume percentage */}
          <div className="text-center text-xs text-muted-gray mt-1">
            {Math.round(volumePercent)}%
          </div>
        </div>
        {/* Arrow pointing down */}
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 rotate-45 border-r border-b border-white/10" style={{ backgroundColor: '#1a1a1a' }} />
      </div>

      {/* Mute Button */}
      <button
        onClick={actions.toggleMute}
        className="p-2 rounded hover:bg-white/10 transition-colors text-bone-white/70 hover:text-bone-white"
        title={state.isMuted ? 'Unmute (M)' : 'Mute (M)'}
      >
        {getVolumeIcon()}
      </button>
    </div>
  );
};

export default VolumeControl;
