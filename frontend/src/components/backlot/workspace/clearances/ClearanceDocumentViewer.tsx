/**
 * ClearanceDocumentViewer - Unified document viewer for clearance files
 * Automatically selects the appropriate viewer based on file type
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileText,
  ExternalLink,
  File,
} from 'lucide-react';
import { getClearanceFileType, getClearanceFileTypeLabel, ClearanceFileType } from '@/types/backlot';
import { ClearancePDFViewer } from './ClearancePDFViewer';
import { ImagePreview } from './ImagePreview';
import { SpreadsheetPreview } from './SpreadsheetPreview';

interface ClearanceDocumentViewerProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  contentType?: string | null;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Document download card for file types that can't be previewed
 */
function DocumentDownloadCard({
  fileUrl,
  fileName,
  fileSize,
  fileType,
}: {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
  fileType: ClearanceFileType;
}) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNew = () => {
    window.open(fileUrl, '_blank');
  };

  const IconComponent = fileType === 'document' ? FileText : File;

  return (
    <div className="flex flex-col h-full bg-charcoal-black items-center justify-center p-8">
      <div className="max-w-md w-full bg-muted-gray/10 rounded-lg border border-muted-gray/30 p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center">
            <IconComponent className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        {/* File info */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-medium text-bone-white mb-2 break-all">
            {fileName}
          </h3>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getClearanceFileTypeLabel(fileType)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatFileSize(fileSize)}
            </Badge>
          </div>
        </div>

        {/* Info message */}
        <p className="text-sm text-muted-gray text-center mb-6">
          {fileType === 'document'
            ? 'Word documents can\'t be previewed directly in the browser. Download the file to view its contents.'
            : 'This file type can\'t be previewed directly. Download to view.'}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleDownload}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Download File
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenInNew}
            className="w-full"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in New Tab
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ClearanceDocumentViewer({
  fileUrl,
  fileName,
  fileSize,
  contentType,
}: ClearanceDocumentViewerProps) {
  const fileType = getClearanceFileType(fileName);

  switch (fileType) {
    case 'pdf':
      return <ClearancePDFViewer fileUrl={fileUrl} fileName={fileName} />;

    case 'image':
      return <ImagePreview fileUrl={fileUrl} fileName={fileName} />;

    case 'spreadsheet':
      return <SpreadsheetPreview fileUrl={fileUrl} fileName={fileName} fileSize={fileSize} />;

    case 'document':
    default:
      return (
        <DocumentDownloadCard
          fileUrl={fileUrl}
          fileName={fileName}
          fileSize={fileSize}
          fileType={fileType}
        />
      );
  }
}
