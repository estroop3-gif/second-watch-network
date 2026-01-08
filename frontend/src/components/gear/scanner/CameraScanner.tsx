/**
 * Camera Scanner Component
 * Provides camera-based barcode/QR code scanning UI with viewfinder overlay
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { Camera, RefreshCw, X, Loader2, CameraOff, AlertCircle, Barcode, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCameraScanner } from '@/hooks/gear/useCameraScanner';
import type { ScanResult, CameraScannerOptions, ScanType } from '@/types/scanner';
import { cn } from '@/lib/utils';

interface CameraScannerProps extends Omit<CameraScannerOptions, 'scanType'> {
  onScan: (result: ScanResult) => void;
  onClose: () => void;
  title?: string;
  className?: string;
  initialScanType?: ScanType;
}

export function CameraScanner({
  onScan,
  onClose,
  title = 'Scan Code',
  className,
  initialScanType = 'both',
  ...options
}: CameraScannerProps) {
  const viewfinderRef = useRef<HTMLDivElement>(null);
  const [elementId, setElementId] = useState(`camera-scanner-${Date.now()}`);
  const [isInitializing, setIsInitializing] = useState(true);
  const [scanType, setScanType] = useState<ScanType>(initialScanType);
  const isMountedRef = useRef(true);

  const {
    isScanning,
    hasPermission,
    permissionDenied,
    availableCameras,
    selectedCameraId,
    error,
    startScanning,
    stopScanning,
    switchCamera,
  } = useCameraScanner({ ...options, scanType });

  // Handle scan result
  const handleScan = useCallback(
    (result: ScanResult) => {
      onScan(result);
    },
    [onScan]
  );

  // Handle scan type change - stop current scanner and create new element
  const handleScanTypeChange = useCallback(async (newType: ScanType) => {
    if (newType === scanType) return;

    console.log('[CameraScanner] Switching scan type to:', newType);
    setIsInitializing(true);
    await stopScanning();

    // Generate new element ID and set new scan type
    setElementId(`camera-scanner-${Date.now()}`);
    setScanType(newType);
  }, [scanType, stopScanning]);

  // Track mount state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Start scanning on mount and when elementId changes (after scan type change)
  useEffect(() => {
    // Small delay to ensure new element is in DOM
    const timer = setTimeout(() => {
      if (!isMountedRef.current) return;

      startScanning(elementId, handleScan).finally(() => {
        if (isMountedRef.current) {
          setIsInitializing(false);
        }
      });
    }, 50);

    return () => {
      clearTimeout(timer);
      stopScanning();
    };
  }, [elementId, startScanning, stopScanning, handleScan]);

  // Handle camera switch
  const handleSwitchCamera = useCallback(async () => {
    if (availableCameras.length <= 1) return;

    const currentIndex = availableCameras.findIndex((c) => c.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % availableCameras.length;
    const nextCamera = availableCameras[nextIndex];

    await switchCamera(nextCamera.id, elementId, handleScan);
  }, [availableCameras, selectedCameraId, switchCamera, handleScan, elementId]);

  // Render permission denied state
  if (permissionDenied) {
    return (
      <div className={cn('flex flex-col h-full bg-charcoal-black', className)}>
        <Header title={title} onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-red/20 flex items-center justify-center mb-4">
            <CameraOff className="w-8 h-8 text-primary-red" />
          </div>
          <h3 className="text-lg font-semibold text-bone-white mb-2">Camera Access Denied</h3>
          <p className="text-muted-gray text-sm max-w-xs mb-6">
            Please allow camera access in your browser settings to scan barcodes.
          </p>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !isScanning && !isInitializing) {
    return (
      <div className={cn('flex flex-col h-full bg-charcoal-black', className)}>
        <Header title={title} onClose={onClose} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary-red/20 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-primary-red" />
          </div>
          <h3 className="text-lg font-semibold text-bone-white mb-2">Scanner Error</h3>
          <p className="text-muted-gray text-sm max-w-xs mb-6">{error}</p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsInitializing(true);
                startScanning(elementId, handleScan).finally(() => {
                  setIsInitializing(false);
                });
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-charcoal-black', className)}>
      <Header title={title} onClose={onClose} />

      {/* Viewfinder area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Camera feed container */}
        <div
          ref={viewfinderRef}
          id={elementId}
          className="absolute inset-0 flex items-center justify-center"
        />

        {/* Loading overlay */}
        {(isInitializing || (hasPermission === null && !error)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-charcoal-black z-10">
            <Loader2 className="w-10 h-10 text-accent-yellow animate-spin mb-4" />
            <p className="text-muted-gray text-sm">Starting camera...</p>
          </div>
        )}

        {/* Scanning overlay with corner brackets */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {/* Darkened corners */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={cn(
                  'relative',
                  scanType === 'qr' ? 'w-56 h-56' : scanType === 'barcode' ? 'w-72 h-32' : 'w-64 h-48'
                )}
              >
                {/* Corner brackets */}
                <CornerBrackets />

                {/* Scanning line animation */}
                <div className="absolute inset-x-4 top-4 bottom-4 overflow-hidden">
                  <div className="animate-scan-line absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-accent-yellow to-transparent" />
                </div>
              </div>
            </div>

            {/* Instruction text */}
            <div className="absolute bottom-24 left-0 right-0 text-center">
              <p className="text-bone-white/80 text-sm font-medium drop-shadow-lg">
                {scanType === 'qr' ? 'Position QR code within frame' : scanType === 'barcode' ? 'Position barcode within frame' : 'Position code within frame'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls footer */}
      <div className="flex flex-col gap-2 px-4 py-3 bg-charcoal-black/90 border-t border-white/10">
        {/* Scan type toggle */}
        <div className="flex items-center justify-center gap-1 p-1 rounded-lg bg-muted-gray/20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleScanTypeChange('barcode')}
            className={cn(
              'h-8 px-3 gap-1.5 transition-all',
              scanType === 'barcode'
                ? 'bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30'
                : 'text-muted-gray hover:text-bone-white hover:bg-white/10'
            )}
          >
            <Barcode className="w-4 h-4" />
            <span className="text-xs font-medium">Barcode</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleScanTypeChange('qr')}
            className={cn(
              'h-8 px-3 gap-1.5 transition-all',
              scanType === 'qr'
                ? 'bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30'
                : 'text-muted-gray hover:text-bone-white hover:bg-white/10'
            )}
          >
            <QrCode className="w-4 h-4" />
            <span className="text-xs font-medium">QR Code</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleScanTypeChange('both')}
            className={cn(
              'h-8 px-3 gap-1.5 transition-all',
              scanType === 'both'
                ? 'bg-accent-yellow/20 text-accent-yellow hover:bg-accent-yellow/30'
                : 'text-muted-gray hover:text-bone-white hover:bg-white/10'
            )}
          >
            <span className="text-xs font-medium">Both</span>
          </Button>
        </div>

        {/* Status and camera switch */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isScanning ? (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
                <span className="text-sm text-bone-white">Scanning...</span>
              </>
            ) : (
              <>
                <Camera className="w-4 h-4 text-muted-gray" />
                <span className="text-sm text-muted-gray">Camera ready</span>
              </>
            )}
          </div>

          {availableCameras.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchCamera}
              className="text-bone-white hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Switch Camera
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Header component
function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
      <div className="flex items-center gap-2">
        <Camera className="w-5 h-5 text-accent-yellow" />
        <h2 className="text-lg font-semibold text-bone-white">{title}</h2>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="text-bone-white hover:bg-white/10"
      >
        <X className="w-5 h-5" />
      </Button>
    </div>
  );
}

// Corner brackets for the scan area
function CornerBrackets() {
  const bracketClass = 'absolute w-8 h-8 border-accent-yellow';

  return (
    <>
      {/* Top-left */}
      <div className={cn(bracketClass, 'top-0 left-0 border-t-2 border-l-2 rounded-tl-lg')} />
      {/* Top-right */}
      <div className={cn(bracketClass, 'top-0 right-0 border-t-2 border-r-2 rounded-tr-lg')} />
      {/* Bottom-left */}
      <div className={cn(bracketClass, 'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg')} />
      {/* Bottom-right */}
      <div className={cn(bracketClass, 'bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg')} />
    </>
  );
}

export default CameraScanner;
