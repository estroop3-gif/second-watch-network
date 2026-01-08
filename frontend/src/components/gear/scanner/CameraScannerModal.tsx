/**
 * Camera Scanner Modal
 * Responsive modal wrapper for camera-based barcode scanning
 * Uses Dialog on desktop, full-screen on mobile
 */
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { CameraScanner } from './CameraScanner';
import type { CameraScannerProps as BaseScannerProps } from '@/types/scanner';

export interface CameraScannerModalProps extends Omit<BaseScannerProps, 'onClose'> {
  isOpen: boolean;
  onClose: () => void;
}

export function CameraScannerModal({
  isOpen,
  onClose,
  onScan,
  onError,
  title = 'Scan Barcode',
  ...options
}: CameraScannerModalProps) {
  const handleScan = (result: Parameters<typeof onScan>[0]) => {
    onScan(result);
    // In single mode, close the modal after scan
    if (options.scanMode !== 'continuous') {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden h-[80vh] sm:h-[70vh] max-h-[600px]"
        hideCloseButton
        aria-describedby={undefined}
      >
        <VisuallyHidden>
          <DialogTitle>{title}</DialogTitle>
        </VisuallyHidden>
        <CameraScanner
          onScan={handleScan}
          onClose={onClose}
          onError={onError}
          title={title}
          {...options}
        />
      </DialogContent>
    </Dialog>
  );
}

export default CameraScannerModal;
