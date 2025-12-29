/**
 * PendingDocumentsSection - Shows pending documents for a user in their profile
 * Part of the Signing Portal feature
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FileCheck,
  FileText,
  Clock,
  ExternalLink,
  Package,
  Loader2,
  AlertCircle,
  CheckCircle,
  Calendar,
} from 'lucide-react';
import { usePendingDocuments } from '@/hooks/backlot';
import {
  PendingDocument,
  CLEARANCE_TYPE_LABELS,
} from '@/types/backlot';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { BatchSigningModal } from './BatchSigningModal';

interface PendingDocumentsSectionProps {
  className?: string;
}

export function PendingDocumentsSection({ className }: PendingDocumentsSectionProps) {
  const { data: documents, isLoading, error } = usePendingDocuments();
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [isBatchSignOpen, setIsBatchSignOpen] = useState(false);

  // Group documents by project
  const documentsByProject = React.useMemo(() => {
    if (!documents) return new Map<string, { projectTitle: string; docs: PendingDocument[] }>();

    const grouped = new Map<string, { projectTitle: string; docs: PendingDocument[] }>();

    documents.forEach((doc) => {
      const existing = grouped.get(doc.project_id);
      if (existing) {
        existing.docs.push(doc);
      } else {
        grouped.set(doc.project_id, {
          projectTitle: doc.project_title,
          docs: [doc],
        });
      }
    });

    return grouped;
  }, [documents]);

  // Get documents that can be batch signed
  const batchSignableDocs = React.useMemo(() => {
    return documents?.filter(
      (doc) => doc.batch_sign_allowed && doc.requires_signature && selectedDocs.has(doc.clearance_id)
    ) || [];
  }, [documents, selectedDocs]);

  const toggleDoc = (docId: string) => {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(docId)) {
        next.delete(docId);
      } else {
        next.add(docId);
      }
      return next;
    });
  };

  const selectAllBatchSignable = () => {
    const batchableIds = documents
      ?.filter((doc) => doc.batch_sign_allowed && doc.requires_signature)
      .map((doc) => doc.clearance_id) || [];
    setSelectedDocs(new Set(batchableIds));
  };

  const clearSelection = () => {
    setSelectedDocs(new Set());
  };

  if (error) {
    return (
      <Card className={cn('bg-charcoal-black border-muted-gray/30', className)}>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load pending documents</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={cn('bg-charcoal-black border-muted-gray/30', className)}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const totalCount = documents?.length || 0;

  if (totalCount === 0) {
    return (
      <Card className={cn('bg-charcoal-black border-muted-gray/30', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-bone-white">
            <FileCheck className="h-5 w-5 text-green-500" />
            Pending Documents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-bone-white font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">
              You have no pending documents to sign.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn('bg-charcoal-black border-muted-gray/30', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-bone-white">
              <FileCheck className="h-5 w-5 text-primary-red" />
              Pending Documents
              <Badge variant="outline" className="ml-2 text-yellow-400 border-yellow-500/30">
                {totalCount} pending
              </Badge>
            </CardTitle>

            {batchSignableDocs.length > 0 && (
              <Button
                size="sm"
                className="bg-primary-red hover:bg-primary-red/90"
                onClick={() => setIsBatchSignOpen(true)}
              >
                <FileCheck className="h-4 w-4 mr-2" />
                Sign Selected ({batchSignableDocs.length})
              </Button>
            )}
          </div>

          {/* Selection controls */}
          {documents && documents.some((d) => d.batch_sign_allowed) && (
            <div className="flex items-center gap-3 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={selectAllBatchSignable}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={clearSelection}
              >
                Clear Selection
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {Array.from(documentsByProject.entries()).map(([projectId, { projectTitle, docs }]) => (
            <div key={projectId} className="space-y-3">
              {/* Project Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-muted-gray/20">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-bone-white">{projectTitle}</span>
                <Badge variant="outline" className="text-xs">
                  {docs.length} docs
                </Badge>
              </div>

              {/* Documents */}
              <div className="space-y-2">
                {docs.map((doc) => (
                  <PendingDocumentRow
                    key={doc.clearance_id}
                    document={doc}
                    selected={selectedDocs.has(doc.clearance_id)}
                    onToggle={() => toggleDoc(doc.clearance_id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Batch Signing Modal */}
      <BatchSigningModal
        open={isBatchSignOpen}
        onClose={() => {
          setIsBatchSignOpen(false);
          setSelectedDocs(new Set());
        }}
        documents={batchSignableDocs}
      />
    </>
  );
}

// Individual Document Row
function PendingDocumentRow({
  document: doc,
  selected,
  onToggle,
}: {
  document: PendingDocument;
  selected: boolean;
  onToggle: () => void;
}) {
  const canBatchSign = doc.batch_sign_allowed && doc.requires_signature;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        selected
          ? 'bg-primary-red/10 border-primary-red/30'
          : 'bg-muted-gray/5 border-muted-gray/20 hover:bg-muted-gray/10'
      )}
    >
      {/* Checkbox for batch signing */}
      {canBatchSign && (
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          className="flex-shrink-0"
        />
      )}

      {/* Document Icon */}
      <div className="h-10 w-10 rounded bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Document Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-bone-white truncate">
          {doc.clearance_title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <Badge variant="outline" className="text-xs">
            {CLEARANCE_TYPE_LABELS[doc.clearance_type] || doc.clearance_type}
          </Badge>
          {doc.due_date && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Due {format(new Date(doc.due_date), 'MMM d')}
            </span>
          )}
        </div>
      </div>

      {/* Status / Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {doc.requires_signature ? (
          <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Needs Signature
          </Badge>
        ) : (
          <Badge variant="outline" className="text-blue-400 border-blue-500/30">
            Review Required
          </Badge>
        )}

        <Link
          to={`/clearance/${doc.access_token}`}
          className="text-muted-foreground hover:text-primary-red transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
