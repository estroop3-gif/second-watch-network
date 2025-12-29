/**
 * SpreadsheetPreview - Spreadsheet file preview for clearance documents
 * MVP version: Shows file info with download (no inline preview)
 */
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  FileSpreadsheet,
  ExternalLink,
} from 'lucide-react';

interface SpreadsheetPreviewProps {
  fileUrl: string;
  fileName: string;
  fileSize?: number | null;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSpreadsheetType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop();
  switch (ext) {
    case 'xlsx':
      return 'Microsoft Excel';
    case 'xls':
      return 'Microsoft Excel (Legacy)';
    case 'csv':
      return 'CSV';
    default:
      return 'Spreadsheet';
  }
}

export function SpreadsheetPreview({ fileUrl, fileName, fileSize }: SpreadsheetPreviewProps) {
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

  const fileType = getSpreadsheetType(fileName);

  return (
    <div className="flex flex-col h-full bg-charcoal-black items-center justify-center p-8">
      <div className="max-w-md w-full bg-muted-gray/10 rounded-lg border border-muted-gray/30 p-6">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
            <FileSpreadsheet className="w-8 h-8 text-green-500" />
          </div>
        </div>

        {/* File info */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-medium text-bone-white mb-2 break-all">
            {fileName}
          </h3>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="text-xs">
              {fileType}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatFileSize(fileSize)}
            </Badge>
          </div>
        </div>

        {/* Info message */}
        <p className="text-sm text-muted-gray text-center mb-6">
          Spreadsheet files can't be previewed directly in the browser.
          Download the file to view its contents.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleDownload}
            className="w-full bg-green-500 hover:bg-green-600 text-white"
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
