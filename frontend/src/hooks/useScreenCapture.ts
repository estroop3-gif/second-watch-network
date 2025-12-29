import { useState, useCallback } from 'react';

interface ScreenCaptureResult {
  blob: Blob;
  dataUrl: string;
}

export function useScreenCapture() {
  const [isCapturing, setIsCapturing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);

  const captureScreen = useCallback(async (): Promise<ScreenCaptureResult | null> => {
    setIsCapturing(true);

    try {
      // Request screen capture permission and get media stream
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
        } as MediaTrackConstraints,
        audio: false,
      });

      // Create video element to capture frame
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;

      // Wait for video to be ready
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve();
        };
      });

      // Small delay to ensure frame is rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create canvas and draw video frame
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      ctx.drawImage(video, 0, 0);

      // Stop all tracks to release the screen capture
      stream.getTracks().forEach(track => track.stop());

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Failed to create blob'));
          },
          'image/png',
          1.0
        );
      });

      const dataUrl = canvas.toDataURL('image/png');

      setPreview(dataUrl);
      setCapturedBlob(blob);
      setIsCapturing(false);

      return { blob, dataUrl };
    } catch (err) {
      console.error('Screen capture failed:', err);
      setIsCapturing(false);
      return null;
    }
  }, []);

  const clearCapture = useCallback(() => {
    setPreview(null);
    setCapturedBlob(null);
  }, []);

  return {
    captureScreen,
    clearCapture,
    isCapturing,
    preview,
    capturedBlob,
  };
}
