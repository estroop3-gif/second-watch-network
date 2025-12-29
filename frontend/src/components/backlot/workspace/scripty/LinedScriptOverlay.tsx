/**
 * LinedScriptOverlay - Simple PDF viewer for scripts
 *
 * Displays the script PDF with native browser PDF handling.
 * Scrolling and zooming are handled by the browser's PDF viewer.
 */
import React from 'react';
import { FileText } from 'lucide-react';

interface LinedScriptOverlayProps {
  projectId: string;
  scriptId: string | null;
  sceneId: string | null;
  pageNumber: number;
  canEdit: boolean;
  fileUrl?: string;
  isFullscreen?: boolean;
}

const LinedScriptOverlay: React.FC<LinedScriptOverlayProps> = ({
  scriptId,
  pageNumber,
  fileUrl,
}) => {
  // No script selected
  if (!scriptId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-gray">
        Select a script to view
      </div>
    );
  }

  return (
    <div data-testid="lined-script-overlay" className="h-full w-full">
      {fileUrl ? (
        <iframe
          data-testid="pdf-iframe"
          src={`${fileUrl}#page=${pageNumber}&view=FitH&toolbar=0&navpanes=0`}
          className="w-full h-full border-0 bg-white"
          title="Script PDF"
        />
      ) : (
        <div data-testid="no-pdf-message" className="w-full h-full flex items-center justify-center bg-charcoal-black text-bone-white">
          <div className="text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-muted-gray" />
            <p className="text-lg font-medium text-bone-white">No PDF Available</p>
            <p className="text-sm mt-1 text-muted-gray">Page {pageNumber}</p>
            <p className="text-xs mt-4 text-muted-gray">Upload a script to view it here</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default LinedScriptOverlay;
