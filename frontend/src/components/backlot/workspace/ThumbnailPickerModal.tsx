/**
 * ThumbnailPickerModal - Instagram-style thumbnail picker for video clips
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThumbnailPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  clipId: string;
  streamUrl: string;
  duration: number;
  onThumbnailSelected: (thumbnailUrl: string) => void;
}

const ThumbnailPickerModal: React.FC<ThumbnailPickerModalProps> = ({
  isOpen,
  onClose,
  clipId,
  streamUrl,
  duration,
  onThumbnailSelected,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isGeneratingFilmstrip, setIsGeneratingFilmstrip] = useState(false);
  const [framePreviews, setFramePreviews] = useState<{ time: number; dataUrl: string }[]>([]);
  const [currentFramePreview, setCurrentFramePreview] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Capture current frame as data URL
  const captureFrameAsDataUrl = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    return canvas.toDataURL('image/jpeg', 0.85);
  }, []);

  // Update current frame preview when time changes
  const updateCurrentFramePreview = useCallback(() => {
    const dataUrl = captureFrameAsDataUrl();
    if (dataUrl) {
      setCurrentFramePreview(dataUrl);
    }
  }, [captureFrameAsDataUrl]);

  // Generate filmstrip with evenly-spaced frames
  const generateFilmstrip = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !duration || duration <= 0) return;

    setIsGeneratingFilmstrip(true);
    const frameCount = 8;
    const frames: { time: number; dataUrl: string }[] = [];

    try {
      for (let i = 0; i < frameCount; i++) {
        // Evenly space frames, including first and last
        const time = (duration / (frameCount - 1)) * i;

        // Seek to the time
        video.currentTime = time;

        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });

        // Small delay to ensure frame is rendered
        await new Promise((r) => setTimeout(r, 50));

        const dataUrl = captureFrameAsDataUrl();
        if (dataUrl) {
          frames.push({ time, dataUrl });
        }
      }

      setFramePreviews(frames);

      // Set initial preview to first frame
      if (frames.length > 0) {
        setCurrentFramePreview(frames[0].dataUrl);
        setCurrentTime(0);
        video.currentTime = 0;
      }
    } catch (err) {
      console.error('Error generating filmstrip:', err);
    } finally {
      setIsGeneratingFilmstrip(false);
    }
  }, [duration, captureFrameAsDataUrl]);

  // Handle video loaded
  const handleVideoLoaded = useCallback(() => {
    setIsVideoReady(true);
    generateFilmstrip();
  }, [generateFilmstrip]);

  // Handle seeking via slider
  const handleSliderChange = useCallback(
    async (value: number[]) => {
      const video = videoRef.current;
      if (!video) return;

      const newTime = value[0];
      setCurrentTime(newTime);
      setSelectedFrameIndex(null); // Deselect filmstrip frame

      video.currentTime = newTime;

      // Wait for seek then update preview
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      updateCurrentFramePreview();
    },
    [updateCurrentFramePreview]
  );

  // Handle clicking a filmstrip frame
  const handleFrameClick = useCallback(
    async (index: number) => {
      const video = videoRef.current;
      const frame = framePreviews[index];
      if (!video || !frame) return;

      setSelectedFrameIndex(index);
      setCurrentTime(frame.time);
      setCurrentFramePreview(frame.dataUrl);

      video.currentTime = frame.time;
    },
    [framePreviews]
  );

  // Handle confirming the selected thumbnail
  const handleConfirm = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || isCapturing) return;

    setIsCapturing(true);
    try {
      // Make sure we're at the right time
      await new Promise<void>((resolve) => {
        if (Math.abs(video.currentTime - currentTime) < 0.1) {
          resolve();
        } else {
          video.currentTime = currentTime;
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        }
      });

      // Capture frame as blob
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create blob'));
          },
          'image/jpeg',
          0.85
        );
      });

      // Get presigned upload URL
      const token = localStorage.getItem('access_token');
      const presignedResponse = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/backlot/dailies/clips/${clipId}/thumbnail-upload-url`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!presignedResponse.ok) {
        throw new Error('Failed to get thumbnail upload URL');
      }

      const { upload_url, thumbnail_url } = await presignedResponse.json();

      // Upload to S3
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'image/jpeg',
        },
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload thumbnail');
      }

      // Notify parent and close
      onThumbnailSelected(thumbnail_url);
      onClose();
    } catch (err) {
      console.error('Failed to capture thumbnail:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFramePreviews([]);
      setCurrentFramePreview(null);
      setCurrentTime(0);
      setIsVideoReady(false);
      setSelectedFrameIndex(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-charcoal-black border-muted-gray/20">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Select Thumbnail</DialogTitle>
        </DialogHeader>

        {/* Hidden video and canvas elements */}
        <video
          ref={videoRef}
          src={streamUrl}
          crossOrigin="anonymous"
          className="hidden"
          onLoadedMetadata={handleVideoLoaded}
          preload="auto"
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Loading state */}
        {!isVideoReady && (
          <div className="aspect-video bg-charcoal-black/50 rounded-lg flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-muted-gray animate-spin" />
          </div>
        )}

        {/* Main content - only show when video is ready */}
        {isVideoReady && (
          <div className="space-y-4">
            {/* Preview Area */}
            <div className="aspect-video bg-charcoal-black rounded-lg overflow-hidden border border-muted-gray/20">
              {currentFramePreview ? (
                <img
                  src={currentFramePreview}
                  alt="Thumbnail preview"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-muted-gray animate-spin" />
                </div>
              )}
            </div>

            {/* Time Display */}
            <div className="text-center text-sm text-muted-gray font-mono">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* Timeline Slider */}
            <div className="px-2">
              <Slider
                value={[currentTime]}
                min={0}
                max={duration}
                step={0.1}
                onValueChange={handleSliderChange}
                className="w-full"
              />
            </div>

            {/* Filmstrip */}
            <div className="flex gap-2 overflow-x-auto py-2 px-1">
              {isGeneratingFilmstrip ? (
                <div className="w-full flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 text-muted-gray animate-spin" />
                  <span className="ml-2 text-sm text-muted-gray">Generating frames...</span>
                </div>
              ) : (
                framePreviews.map((frame, i) => (
                  <button
                    key={i}
                    onClick={() => handleFrameClick(i)}
                    className={cn(
                      'shrink-0 w-24 aspect-video rounded overflow-hidden border-2 transition-all hover:scale-105',
                      selectedFrameIndex === i
                        ? 'border-accent-yellow ring-2 ring-accent-yellow/30'
                        : 'border-muted-gray/30 hover:border-muted-gray/60'
                    )}
                  >
                    <img
                      src={frame.dataUrl}
                      alt={`Frame at ${formatTime(frame.time)}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-muted-gray/20 pt-4 mt-2">
          <Button variant="outline" onClick={onClose} disabled={isCapturing}>
            Cancel
          </Button>
          <Button
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            onClick={handleConfirm}
            disabled={isCapturing || !isVideoReady || !currentFramePreview}
          >
            {isCapturing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Use This Frame'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ThumbnailPickerModal;
