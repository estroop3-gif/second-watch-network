/**
 * ClearanceDocumentTab - Full document viewer with upload and version history
 * 2/3 viewer + 1/3 sidebar layout
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  FileCheck,
  FileX,
  History,
  Upload,
  AlertCircle,
  Info,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BacklotClearanceItem, getClearanceFileType, getClearanceFileTypeLabel } from '@/types/backlot';
import { useClearanceDocumentVersions } from '@/hooks/backlot/useClearances';
import { ClearanceDocumentViewer } from './ClearanceDocumentViewer';
import { ClearanceDocumentUpload } from './ClearanceDocumentUpload';
import { DocumentVersionHistory } from './DocumentVersionHistory';

interface ClearanceDocumentTabProps {
  clearance: BacklotClearanceItem;
  canEdit: boolean;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClearanceDocumentTab({
  clearance,
  canEdit,
}: ClearanceDocumentTabProps) {
  const { data: versions } = useClearanceDocumentVersions(clearance.id);

  const hasDocument = !!clearance.file_url;
  const fileType = clearance.file_name ? getClearanceFileType(clearance.file_name) : 'other';
  const fileTypeLabel = getClearanceFileTypeLabel(fileType);
  const versionCount = versions?.length || 0;
  const currentVersion = versions?.find(v => v.is_current);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Viewer Area (2 cols) */}
      <div className="lg:col-span-2">
        {hasDocument ? (
          <div className="h-[600px] bg-charcoal-black border border-muted-gray/30 rounded-lg overflow-hidden">
            <ClearanceDocumentViewer
              fileUrl={clearance.file_url!}
              fileName={clearance.file_name!}
            />
          </div>
        ) : (
          <div className="h-[600px] bg-charcoal-black border border-muted-gray/30 rounded-lg flex flex-col items-center justify-center p-8">
            <div className="w-20 h-20 rounded-full bg-muted-gray/20 flex items-center justify-center mb-4">
              <FileX className="w-10 h-10 text-muted-gray" />
            </div>
            <h3 className="text-lg font-medium text-bone-white mb-2">No Document Uploaded</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
              Upload a document to view it here. Supported formats include PDF, images,
              Word documents, and spreadsheets.
            </p>
            {canEdit && (
              <div className="w-full max-w-md">
                <ClearanceDocumentUpload
                  clearanceId={clearance.id}
                  currentFileUrl={clearance.file_url}
                  currentFileName={clearance.file_name}
                  isSensitive={clearance.file_is_sensitive}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar (1 col) */}
      <div className="space-y-4">
        {/* Document Info Card */}
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4" />
              Document Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              {hasDocument ? (
                <Badge className="bg-green-500/10 text-green-400 border border-green-500/30">
                  <FileCheck className="w-3 h-3 mr-1" />
                  Uploaded
                </Badge>
              ) : (
                <Badge className="bg-gray-500/10 text-gray-500 border border-gray-500/30">
                  <FileX className="w-3 h-3 mr-1" />
                  Missing
                </Badge>
              )}
            </div>

            {hasDocument && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">File Name</span>
                  <span className="text-sm text-bone-white truncate max-w-[150px]" title={clearance.file_name || ''}>
                    {clearance.file_name}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Type</span>
                  <Badge variant="outline" className="text-xs">
                    {fileTypeLabel}
                  </Badge>
                </div>

                {currentVersion && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Size</span>
                      <span className="text-sm text-bone-white">
                        {formatFileSize(currentVersion.file_size)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Uploaded</span>
                      <span className="text-sm text-bone-white">
                        {format(parseISO(currentVersion.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {currentVersion.uploaded_by_name && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">By</span>
                        <span className="text-sm text-bone-white">
                          {currentVersion.uploaded_by_name}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {clearance.file_is_sensitive && (
              <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-md mt-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                <span className="text-xs text-yellow-400">Sensitive - Downloads restricted</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version History Card */}
        {versionCount > 1 && (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" />
                Version History ({versionCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentVersionHistory clearanceId={clearance.id} canEdit={canEdit} />
            </CardContent>
          </Card>
        )}

        {/* Upload New Version Card */}
        {hasDocument && canEdit && (
          <Card className="bg-charcoal-black border-muted-gray/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload New Version
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ClearanceDocumentUpload
                clearanceId={clearance.id}
                currentFileUrl={clearance.file_url}
                currentFileName={clearance.file_name}
                isSensitive={clearance.file_is_sensitive}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
