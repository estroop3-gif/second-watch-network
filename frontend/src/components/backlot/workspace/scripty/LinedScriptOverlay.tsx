/**
 * LinedScriptOverlay - PDF viewer for scripts
 *
 * In Continuity mode (exportId provided): Uses ContinuityPDFAnnotator with
 * persistent annotations (highlight, draw, notes) saved per version.
 *
 * In Script mode: Simple iframe viewer with native browser PDF handling.
 */
import React from 'react';
import { FileText } from 'lucide-react';
import ContinuityPDFAnnotator from '../continuity/ContinuityPDFAnnotator';

interface LinedScriptOverlayProps {
  projectId: string;
  scriptId: string | null;
  sceneId: string | null;
  pageNumber: number;
  canEdit: boolean;
  fileUrl?: string;
  isFullscreen?: boolean;
  scrollY?: number;
  // Annotation support (for Continuity tab)
  exportId?: string;
  showAnnotationToolbar?: boolean;
}

const LinedScriptOverlay: React.FC<LinedScriptOverlayProps> = ({
  projectId,
  scriptId,
  pageNumber,
  canEdit,
  fileUrl,
  scrollY,
  exportId,
  showAnnotationToolbar = false,
}) => {
  // No script selected (for Script tab mode)
  if (!scriptId && !exportId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-gray">
        Select a script to view
      </div>
    );
  }

  // No PDF URL
  if (!fileUrl) {
    return (
      <div data-testid="no-pdf-message" className="w-full h-full flex items-center justify-center bg-charcoal-black text-bone-white">
        <div className="text-center">
          <FileText className="w-16 h-16 mx-auto mb-4 text-muted-gray" />
          <p className="text-lg font-medium text-bone-white">No PDF Available</p>
          <p className="text-sm mt-1 text-muted-gray">Page {pageNumber}</p>
          <p className="text-xs mt-4 text-muted-gray">Upload a script to view it here</p>
        </div>
      </div>
    );
  }

  // Continuity mode - use PDF annotator with persistent annotations
  if (exportId && showAnnotationToolbar) {
    return (
      <div data-testid="lined-script-overlay" className="h-full w-full">
        <ContinuityPDFAnnotator
          projectId={projectId}
          exportId={exportId}
          fileUrl={fileUrl}
          initialPage={pageNumber}
          canEdit={canEdit}
        />
      </div>
    );
  }

  // Script mode - simple iframe with native browser PDF viewer
  return (
    <div data-testid="lined-script-overlay" className="h-full w-full">
      <iframe
        data-testid="pdf-iframe"
        src={`${fileUrl}#page=${pageNumber}${scrollY !== undefined ? `&zoom=auto,0,${scrollY}` : '&view=FitH'}`}
        className="w-full h-full border-0 bg-white"
        title="Script PDF"
      />
    </div>
  );
};

export default LinedScriptOverlay;
