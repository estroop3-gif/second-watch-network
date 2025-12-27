/**
 * FolderBreadcrumbs - Navigation breadcrumbs for folder hierarchy
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { ReviewFolderBreadcrumb } from '@/types/backlot';
import { ChevronRight, Home, Folder } from 'lucide-react';

interface FolderBreadcrumbsProps {
  breadcrumbs: ReviewFolderBreadcrumb[];
  onNavigate: (folderId: string | null) => void;
  className?: string;
}

const FolderBreadcrumbs: React.FC<FolderBreadcrumbsProps> = ({
  breadcrumbs,
  onNavigate,
  className,
}) => {
  return (
    <nav className={cn('flex items-center gap-1 text-sm', className)}>
      {/* Root */}
      <button
        onClick={() => onNavigate(null)}
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded transition-colors',
          breadcrumbs.length === 0
            ? 'text-bone-white font-medium'
            : 'text-muted-gray hover:text-bone-white hover:bg-white/5'
        )}
      >
        <Home className="w-3.5 h-3.5" />
        <span>All Assets</span>
      </button>

      {/* Breadcrumb Items */}
      {breadcrumbs.map((crumb, index) => {
        const isLast = index === breadcrumbs.length - 1;

        return (
          <React.Fragment key={crumb.id}>
            <ChevronRight className="w-3.5 h-3.5 text-muted-gray flex-shrink-0" />
            <button
              onClick={() => onNavigate(crumb.id)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded transition-colors truncate max-w-[150px]',
                isLast
                  ? 'text-bone-white font-medium'
                  : 'text-muted-gray hover:text-bone-white hover:bg-white/5'
              )}
              title={crumb.name}
            >
              <Folder className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{crumb.name}</span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default FolderBreadcrumbs;
