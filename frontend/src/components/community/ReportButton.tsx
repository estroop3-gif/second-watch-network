import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Flag, MoreVertical } from 'lucide-react';
import ReportDialog from './ReportDialog';
import { useAuth } from '@/context/AuthContext';

interface ReportButtonProps {
  contentType: 'thread' | 'reply';
  contentId: string;
  contentPreview?: string;
  variant?: 'icon' | 'menu' | 'both';
  className?: string;
}

// Flag icon button variant
export const ReportFlagButton: React.FC<{
  onClick: () => void;
  className?: string;
}> = ({ onClick, className = '' }) => {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`text-zinc-400 hover:text-red-500 hover:bg-red-500/10 ${className}`}
      title="Report content"
    >
      <Flag className="h-4 w-4" />
    </Button>
  );
};

// Three-dot menu variant with report option
export const ReportMenuButton: React.FC<{
  onReport: () => void;
  children?: React.ReactNode;
  className?: string;
}> = ({ onReport, children, className = '' }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={`text-zinc-400 hover:text-white ${className}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {children}
        <DropdownMenuItem
          onClick={onReport}
          className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
        >
          <Flag className="h-4 w-4 mr-2" />
          Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// Combined component that manages the report dialog
const ReportButton: React.FC<ReportButtonProps> = ({
  contentType,
  contentId,
  contentPreview,
  variant = 'both',
  className = '',
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const handleReport = () => {
    if (!isAuthenticated) {
      // Could redirect to login or show a message
      return;
    }
    setDialogOpen(true);
  };

  // Don't render anything if user is not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {variant === 'icon' && (
        <ReportFlagButton onClick={handleReport} className={className} />
      )}

      {variant === 'menu' && (
        <ReportMenuButton onReport={handleReport} className={className} />
      )}

      {variant === 'both' && (
        <div className={`flex items-center gap-1 ${className}`}>
          <ReportFlagButton onClick={handleReport} />
        </div>
      )}

      <ReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contentType={contentType}
        contentId={contentId}
        contentPreview={contentPreview}
      />
    </>
  );
};

export default ReportButton;
