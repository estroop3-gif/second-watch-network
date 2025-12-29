/**
 * AspectRatioGuide - Overlay showing aspect ratio guides on video
 */
import React from 'react';
import { cn } from '@/lib/utils';

export type AspectRatioGuideType =
  | 'none'
  | '16:9'     // Standard HD/4K
  | '2.39:1'   // Anamorphic Widescreen (Scope)
  | '2.35:1'   // CinemaScope
  | '1.85:1'   // Academy Flat
  | '4:3'      // Classic TV
  | '1:1'      // Square (Instagram)
  | '9:16'     // Vertical (TikTok, Reels)
  | '4:5'      // Portrait (Instagram)
  | 'title-safe'  // Title safe area (90%)
  | 'action-safe'; // Action safe area (93%)

interface AspectRatioGuideProps {
  guide: AspectRatioGuideType;
  videoWidth: number;
  videoHeight: number;
  className?: string;
}

// Aspect ratios as decimal values
const ASPECT_RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '2.39:1': 2.39,
  '2.35:1': 2.35,
  '1.85:1': 1.85,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
  '4:5': 4 / 5,
};

const AspectRatioGuide: React.FC<AspectRatioGuideProps> = ({
  guide,
  videoWidth,
  videoHeight,
  className,
}) => {
  if (guide === 'none' || !videoWidth || !videoHeight) {
    return null;
  }

  const videoAspect = videoWidth / videoHeight;

  // For safe area guides
  if (guide === 'title-safe' || guide === 'action-safe') {
    const safePercent = guide === 'title-safe' ? 0.9 : 0.93;
    const inset = ((1 - safePercent) / 2) * 100;

    return (
      <div
        className={cn('absolute inset-0 pointer-events-none', className)}
        style={{ padding: `${inset}%` }}
      >
        <div className="w-full h-full border-2 border-accent-yellow/50 border-dashed rounded" />
      </div>
    );
  }

  const targetAspect = ASPECT_RATIOS[guide];
  if (!targetAspect) return null;

  // Calculate letterbox/pillarbox dimensions
  let top = 0, bottom = 0, left = 0, right = 0;

  if (targetAspect > videoAspect) {
    // Target is wider than video - letterbox (bars on top/bottom)
    const targetHeight = videoWidth / targetAspect;
    const barHeight = (videoHeight - targetHeight) / 2;
    const barPercent = (barHeight / videoHeight) * 100;
    top = barPercent;
    bottom = barPercent;
  } else if (targetAspect < videoAspect) {
    // Target is taller than video - pillarbox (bars on sides)
    const targetWidth = videoHeight * targetAspect;
    const barWidth = (videoWidth - targetWidth) / 2;
    const barPercent = (barWidth / videoWidth) * 100;
    left = barPercent;
    right = barPercent;
  }

  // If target matches video aspect, show just the frame
  if (top === 0 && bottom === 0 && left === 0 && right === 0) {
    return (
      <div className={cn('absolute inset-0 pointer-events-none', className)}>
        <div className="absolute inset-2 border-2 border-accent-yellow/30 rounded" />
      </div>
    );
  }

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      {/* Semi-transparent overlay bars */}
      {top > 0 && (
        <>
          <div
            className="absolute left-0 right-0 top-0 bg-black/60"
            style={{ height: `${top}%` }}
          />
          <div
            className="absolute left-0 right-0 bottom-0 bg-black/60"
            style={{ height: `${bottom}%` }}
          />
        </>
      )}
      {left > 0 && (
        <>
          <div
            className="absolute top-0 bottom-0 left-0 bg-black/60"
            style={{ width: `${left}%` }}
          />
          <div
            className="absolute top-0 bottom-0 right-0 bg-black/60"
            style={{ width: `${right}%` }}
          />
        </>
      )}

      {/* Guide lines */}
      <div
        className="absolute border-2 border-accent-yellow/50 rounded"
        style={{
          top: `${top}%`,
          bottom: `${bottom}%`,
          left: `${left}%`,
          right: `${right}%`,
        }}
      />

      {/* Corner markers */}
      <div
        className="absolute"
        style={{
          top: `${top}%`,
          left: `${left}%`,
        }}
      >
        <div className="w-4 h-4 border-l-2 border-t-2 border-accent-yellow" />
      </div>
      <div
        className="absolute"
        style={{
          top: `${top}%`,
          right: `${right}%`,
        }}
      >
        <div className="w-4 h-4 border-r-2 border-t-2 border-accent-yellow ml-auto" />
      </div>
      <div
        className="absolute"
        style={{
          bottom: `${bottom}%`,
          left: `${left}%`,
        }}
      >
        <div className="w-4 h-4 border-l-2 border-b-2 border-accent-yellow" />
      </div>
      <div
        className="absolute"
        style={{
          bottom: `${bottom}%`,
          right: `${right}%`,
        }}
      >
        <div className="w-4 h-4 border-r-2 border-b-2 border-accent-yellow ml-auto" />
      </div>
    </div>
  );
};

export default AspectRatioGuide;
