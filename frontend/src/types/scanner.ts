/**
 * Camera Scanner Types
 * Type definitions for barcode/QR code scanning functionality
 */

export type ScannerMode = 'usb' | 'camera';

export type CameraScanMode = 'single' | 'continuous';

export type CameraFacing = 'environment' | 'user'; // back / front

export type ScanType = 'barcode' | 'qr' | 'both';

export type ScanFormat =
  | 'CODE_128'
  | 'CODE_39'
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'QR_CODE'
  | 'DATA_MATRIX';

export interface ScanResult {
  code: string;
  format: ScanFormat | string;
  timestamp: Date;
}

export interface CameraScannerState {
  isScanning: boolean;
  hasPermission: boolean | null; // null = not yet requested
  permissionDenied: boolean;
  availableCameras: CameraDevice[];
  selectedCameraId: string | null;
  lastScan: ScanResult | null;
  error: string | null;
}

export interface CameraDevice {
  id: string;
  label: string;
  facing?: CameraFacing;
}

export interface CameraScannerOptions {
  formats?: ScanFormat[];
  preferredFacing?: CameraFacing;
  scanMode?: CameraScanMode;
  scanType?: ScanType; // barcode, qr, or both
  audioFeedback?: boolean;
  hapticFeedback?: boolean;
  scanDelay?: number; // ms between scans in continuous mode
}

export interface CameraScannerProps extends CameraScannerOptions {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: ScanResult) => void;
  onError?: (error: string) => void;
  title?: string;
}

export interface ScannerModeToggleProps {
  mode: ScannerMode;
  onModeChange: (mode: ScannerMode) => void;
  disabled?: boolean;
  className?: string;
}
