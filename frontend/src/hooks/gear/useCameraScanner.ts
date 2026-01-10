/**
 * Camera Scanner Hook
 * Manages camera access, permissions, and barcode scanning using html5-qrcode
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import type {
  CameraScannerState,
  CameraScannerOptions,
  ScanResult,
  CameraDevice,
  ScanFormat,
  ScanType,
} from '@/types/scanner';

// Map our format types to html5-qrcode formats
const FORMAT_MAP: Record<ScanFormat, Html5QrcodeSupportedFormats> = {
  CODE_128: Html5QrcodeSupportedFormats.CODE_128,
  CODE_39: Html5QrcodeSupportedFormats.CODE_39,
  EAN_13: Html5QrcodeSupportedFormats.EAN_13,
  EAN_8: Html5QrcodeSupportedFormats.EAN_8,
  UPC_A: Html5QrcodeSupportedFormats.UPC_A,
  UPC_E: Html5QrcodeSupportedFormats.UPC_E,
  QR_CODE: Html5QrcodeSupportedFormats.QR_CODE,
  DATA_MATRIX: Html5QrcodeSupportedFormats.DATA_MATRIX,
};

const BARCODE_FORMATS: ScanFormat[] = [
  'CODE_128',
  'CODE_39',
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
];

const QR_FORMATS: ScanFormat[] = ['QR_CODE', 'DATA_MATRIX'];

const ALL_FORMATS: ScanFormat[] = [...BARCODE_FORMATS, ...QR_FORMATS];

// Get formats based on scan type
const getFormatsForScanType = (scanType: ScanType): ScanFormat[] => {
  switch (scanType) {
    case 'barcode':
      return BARCODE_FORMATS;
    case 'qr':
      return QR_FORMATS;
    case 'both':
    default:
      return ALL_FORMATS;
  }
};

// Get qrbox as a function that calculates based on viewfinder size
const getQrboxForScanType = (scanType: ScanType) => {
  return (viewfinderWidth: number, viewfinderHeight: number) => {
    // Use percentage of viewfinder to ensure qrbox fits
    const maxWidth = Math.floor(viewfinderWidth * 0.8);
    const maxHeight = Math.floor(viewfinderHeight * 0.7);

    switch (scanType) {
      case 'barcode':
        // Wide rectangle for barcodes - wider than tall
        return {
          width: Math.min(maxWidth, 300),
          height: Math.min(maxHeight, Math.floor(maxWidth * 0.4), 120)
        };
      case 'qr':
        // Square for QR codes
        const size = Math.min(maxWidth, maxHeight, 250);
        return { width: size, height: size };
      case 'both':
      default:
        // Balanced rectangle
        return {
          width: Math.min(maxWidth, 280),
          height: Math.min(maxHeight, Math.floor(maxWidth * 0.6), 180)
        };
    }
  };
};

// Wait for DOM element to exist before instantiating scanner
const waitForElement = (elementId: string, maxWaitMs = 3000): Promise<HTMLElement> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.getElementById(elementId);
      if (element) {
        resolve(element);
        return;
      }

      if (Date.now() - startTime > maxWaitMs) {
        reject(new Error(`Element with id=${elementId} not found after ${maxWaitMs}ms`));
        return;
      }

      // Check again after a short delay
      requestAnimationFrame(checkElement);
    };

    checkElement();
  });
};

// Audio feedback settings
const BEEP_FREQUENCY = 1800;
const BEEP_DURATION = 100;

export function useCameraScanner(options: CameraScannerOptions = {}) {
  const {
    scanType = 'both',
    formats: customFormats,
    preferredFacing = 'environment',
    scanMode = 'single',
    audioFeedback = true,
    hapticFeedback = true,
    scanDelay = 1500,
  } = options;

  // Use custom formats if provided, otherwise derive from scanType
  const formats = customFormats ?? getFormatsForScanType(scanType);
  const qrbox = getQrboxForScanType(scanType);

  const [state, setState] = useState<CameraScannerState>({
    isScanning: false,
    hasPermission: null,
    permissionDenied: false,
    availableCameras: [],
    selectedCameraId: null,
    lastScan: null,
    error: null,
  });

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const onScanCallbackRef = useRef<((result: ScanResult) => void) | null>(null);

  // Initialize audio context for beep feedback
  const initAudio = useCallback(() => {
    if (!audioContextRef.current && typeof AudioContext !== 'undefined') {
      audioContextRef.current = new AudioContext();
    }
  }, []);

  // Play beep sound
  const playBeep = useCallback(() => {
    if (!audioFeedback || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = BEEP_FREQUENCY;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(ctx.currentTime + BEEP_DURATION / 1000);
  }, [audioFeedback]);

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (!hapticFeedback) return;
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }
  }, [hapticFeedback]);

  // Get available cameras
  const getCameras = useCallback(async (): Promise<CameraDevice[]> => {
    try {
      const devices = await Html5Qrcode.getCameras();
      const cameras: CameraDevice[] = devices.map((device) => ({
        id: device.id,
        label: device.label || `Camera ${device.id.slice(0, 8)}`,
        facing:
          device.label?.toLowerCase().includes('back') ||
          device.label?.toLowerCase().includes('rear')
            ? 'environment'
            : device.label?.toLowerCase().includes('front')
              ? 'user'
              : undefined,
      }));

      setState((prev) => ({ ...prev, availableCameras: cameras }));
      return cameras;
    } catch (err) {
      console.error('[CameraScanner] Failed to enumerate cameras:', err);
      return [];
    }
  }, []);

  // Select preferred camera
  const selectCamera = useCallback(
    (cameras: CameraDevice[]): string | null => {
      if (cameras.length === 0) return null;

      // Try to find camera matching preferred facing
      const preferred = cameras.find((c) => c.facing === preferredFacing);
      if (preferred) return preferred.id;

      // Fall back to first camera
      return cameras[0].id;
    },
    [preferredFacing]
  );

  // Stop scanning
  const stopScanning = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      setState((prev) => ({ ...prev, isScanning: false }));
      return;
    }

    // Clear ref immediately to prevent double-stop
    scannerRef.current = null;

    try {
      const state = scanner.getState();
      // Html5QrcodeScannerState: NOT_STARTED=0, SCANNING=2, PAUSED=3
      if (state === 2) {
        await scanner.stop();
      }
    } catch (err) {
      // Ignore transition errors during HMR/cleanup
      if (!(err instanceof Error) || !err.message.includes('transition')) {
        console.warn('[CameraScanner] Stop warning:', err);
      }
    }

    try {
      scanner.clear();
    } catch {
      // Element may already be removed from DOM
    }

    setState((prev) => ({ ...prev, isScanning: false }));
  }, []);

  // Start scanning
  const startScanning = useCallback(
    async (elementId: string, onScan: (result: ScanResult) => void) => {
      try {
        // Reset error and permission states for fresh attempt
        setState((prev) => ({ ...prev, error: null, permissionDenied: false }));
        onScanCallbackRef.current = onScan;

        // Get cameras
        const cameras = await getCameras();
        if (cameras.length === 0) {
          throw new Error('No cameras found');
        }

        // Select camera
        const cameraId = selectCamera(cameras);
        if (!cameraId) {
          throw new Error('No suitable camera found');
        }

        setState((prev) => ({
          ...prev,
          selectedCameraId: cameraId,
          isScanning: true,
          hasPermission: true,
        }));

        // Wait for element to exist in DOM before initializing scanner
        await waitForElement(elementId);

        // Configure formats for scanning
        const supportedFormats = formats.map((f) => FORMAT_MAP[f]);
        console.log('[CameraScanner] Starting with formats:', formats, 'scanType:', scanType);

        // Initialize scanner with format support
        scannerRef.current = new Html5Qrcode(elementId, {
          formatsToSupport: supportedFormats,
          verbose: true, // Enable verbose logging for debugging
        });

        // Start scanning with dynamic qrbox based on viewfinder size
        await scannerRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox, // This is now a function
          },
          (decodedText, result) => {
            // Debounce scans in continuous mode
            const now = Date.now();
            if (scanMode === 'continuous' && now - lastScanTimeRef.current < scanDelay) {
              return;
            }
            lastScanTimeRef.current = now;

            // Determine format
            const format = (result.result.format?.formatName as ScanFormat) || 'CODE_128';

            const scanResult: ScanResult = {
              code: decodedText,
              format,
              timestamp: new Date(),
            };

            console.log('[CameraScanner] ✅ Scan SUCCESS:', decodedText, 'format:', format);

            // Feedback
            initAudio();
            playBeep();
            triggerHaptic();

            setState((prev) => ({ ...prev, lastScan: scanResult }));

            if (onScanCallbackRef.current) {
              onScanCallbackRef.current(scanResult);
            }

            // Stop if single-shot mode
            if (scanMode === 'single') {
              stopScanning();
            }
          },
          (errorMessage) => {
            // This is called on EVERY frame where no code is found - not an error
            // Only log occasionally to avoid flooding console
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start camera';
        console.error('[CameraScanner] Start error:', err);

        // Check if permission was denied
        if (message.includes('permission') || message.includes('NotAllowedError')) {
          setState((prev) => ({
            ...prev,
            error: 'Camera access denied. Please allow camera access in your browser settings.',
            permissionDenied: true,
            hasPermission: false,
            isScanning: false,
          }));
        } else {
          setState((prev) => ({
            ...prev,
            error: message,
            isScanning: false,
          }));
        }
      }
    },
    [
      getCameras,
      selectCamera,
      formats,
      scanMode,
      scanDelay,
      initAudio,
      playBeep,
      triggerHaptic,
      stopScanning,
    ]
  );

  // Switch camera
  const switchCamera = useCallback(
    async (cameraId: string, elementId: string, onScan: (result: ScanResult) => void) => {
      await stopScanning();
      setState((prev) => ({ ...prev, selectedCameraId: cameraId }));

      // Wait for element to exist in DOM before restarting
      await waitForElement(elementId);

      // Restart scanning with new camera
      try {
        const supportedFormats = formats.map((f) => FORMAT_MAP[f]);

        scannerRef.current = new Html5Qrcode(elementId, {
          formatsToSupport: supportedFormats,
          verbose: true,
        });
        onScanCallbackRef.current = onScan;

        setState((prev) => ({ ...prev, isScanning: true }));

        await scannerRef.current.start(
          cameraId,
          {
            fps: 10,
            qrbox, // This is now a function
          },
          (decodedText, result) => {
            const now = Date.now();
            if (scanMode === 'continuous' && now - lastScanTimeRef.current < scanDelay) {
              return;
            }
            lastScanTimeRef.current = now;

            const format = (result.result.format?.formatName as ScanFormat) || 'CODE_128';
            const scanResult: ScanResult = {
              code: decodedText,
              format,
              timestamp: new Date(),
            };

            initAudio();
            playBeep();
            triggerHaptic();

            setState((prev) => ({ ...prev, lastScan: scanResult }));

            if (onScanCallbackRef.current) {
              onScanCallbackRef.current(scanResult);
            }

            if (scanMode === 'single') {
              stopScanning();
            }
          },
          () => {}
        );
      } catch (err) {
        console.error('[CameraScanner] Switch camera error:', err);
        setState((prev) => ({
          ...prev,
          error: 'Failed to switch camera',
          isScanning: false,
        }));
      }
    },
    [stopScanning, formats, scanMode, scanDelay, initAudio, playBeep, triggerHaptic]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopScanning]);

  return {
    ...state,
    startScanning,
    stopScanning,
    switchCamera,
    getCameras,
  };
}
