/**
 * DocumentPackagesView - Manage document packages (reusable bundles for crew onboarding)
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  Loader2,
  Package,
  Users,
  FileText,
  Send,
  Search,
} from 'lucide-react';
import { useDocumentPackages } from '@/hooks/backlot';
import {
  DocumentPackage,
  DocumentPackageTargetType,
  CLEARANCE_TYPE_LABELS,
} from '@/types/backlot';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PackageCreateEditDialog } from './PackageCreateEditDialog';
import { SendPackageModal } from './SendPackageModal';

interface DocumentPackagesViewProps {
  projectId: string;
  canEdit: boolean;
}

const TARGET_TYPE_LABELS: Record<DocumentPackageTargetType, string> = {
  cast: 'Cast',
  crew: 'Crew',
  all: 'All',
};

const TARGET_TYPE_COLORS: Record<DocumentPackageTargetType, string> = {
  cast: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  crew: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  all: 'bg-green-500/20 text-green-400 border-green-500/30',
};

export function DocumentPackagesView({ projectId, canEdit }: DocumentPackagesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<DocumentPackage | null>(null);
  const [deletingPackage, setDeletingPackage] = useState<DocumentPackage | null>(null);
  const [sendingPackage, setSendingPackage] = useState<DocumentPackage | null>(null);

  const { packages, isLoading, error, deletePackage } = useDocumentPackages(projectId);

  // Filter packages by search
  const filteredPackages = packages.filter((pkg) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      pkg.name.toLowerCase().includes(query) ||
      pkg.description?.toLowerCase().includes(query)
    );
  });

  const handleDelete = async () => {
    if (!deletingPackage) return;

    try {
      await deletePackage.mutateAsync(deletingPackage.id);
      toast.success('Package deleted');
      setDeletingPackage(null);
    } catch (err) {
      toast.error('Failed to delete package', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-400">Error loading packages: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary-red" />
          <h2 className="text-lg font-semibold text-bone-white">Document Packages</h2>
          <Badge variant="outline" className="text-xs">
            {packages.length} packages
          </Badge>
        </div>

        {canEdit && (
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Package
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search packages..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Package Cards */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : filteredPackages.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchQuery ? 'No packages match your search' : 'No document packages yet'}
            </p>
            {canEdit && !searchQuery && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Package
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPackages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              package={pkg}
              canEdit={canEdit}
              onEdit={() => setEditingPackage(pkg)}
              onDelete={() => setDeletingPackage(pkg)}
              onSend={() => setSendingPackage(pkg)}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <PackageCreateEditDialog
        projectId={projectId}
        open={isCreateOpen || !!editingPackage}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingPackage(null);
        }}
        package={editingPackage}
      />

      {/* Send Package Modal */}
      {sendingPackage && (
        <SendPackageModal
          projectId={projectId}
          package={sendingPackage}
          open={!!sendingPackage}
          onClose={() => setSendingPackage(null)}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPackage} onOpenChange={() => setDeletingPackage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Package</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingPackage?.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePackage.isPending}
            >
              {deletePackage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Package Card Component
function PackageCard({
  package: pkg,
  canEdit,
  onEdit,
  onDelete,
  onSend,
}: {
  package: DocumentPackage;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
}) {
  const itemCount = pkg.items?.length || 0;

  return (
    <Card className="bg-charcoal-black border-muted-gray/30 hover:border-primary-red/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-bone-white text-base truncate">{pkg.name}</CardTitle>
            {pkg.description && (
              <CardDescription className="line-clamp-2 mt-1">
                {pkg.description}
              </CardDescription>
            )}
          </div>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Package
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-red-400">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Package
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Target & Item Count */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn('text-xs', TARGET_TYPE_COLORS[pkg.target_type])}>
            <Users className="h-3 w-3 mr-1" />
            {TARGET_TYPE_LABELS[pkg.target_type]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {itemCount} {itemCount === 1 ? 'document' : 'documents'}
          </Badge>
          {pkg.use_count !== undefined && pkg.use_count > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Sent {pkg.use_count} times
            </Badge>
          )}
        </div>

        {/* Document Types Preview */}
        {pkg.items && pkg.items.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pkg.items.slice(0, 3).map((item) => (
              <Badge
                key={item.id}
                variant="secondary"
                className="text-xs bg-muted-gray/20 text-muted-foreground"
              >
                {CLEARANCE_TYPE_LABELS[item.clearance_type] || item.clearance_type}
              </Badge>
            ))}
            {pkg.items.length > 3 && (
              <Badge variant="secondary" className="text-xs bg-muted-gray/20 text-muted-foreground">
                +{pkg.items.length - 3} more
              </Badge>
            )}
          </div>
        )}

        {/* Send Button */}
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-2"
            onClick={onSend}
          >
            <Send className="h-4 w-4 mr-2" />
            Send to Recipients
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
