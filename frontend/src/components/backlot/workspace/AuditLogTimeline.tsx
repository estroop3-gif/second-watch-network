/**
 * AuditLogTimeline - Displays expense audit log entries as a timeline
 */
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Edit,
  CheckCircle,
  XCircle,
  DollarSign,
  MessageSquare,
  Paperclip,
  Trash2,
  Clock,
  User,
} from 'lucide-react';
import type { ExpenseAuditLogEntry } from '@/hooks/backlot/useBudget';

interface AuditLogTimelineProps {
  entries: ExpenseAuditLogEntry[];
  isLoading?: boolean;
}

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
};

// Get action display info
const getActionInfo = (action: string): { icon: React.ReactNode; color: string; label: string } => {
  switch (action) {
    case 'created':
      return { icon: <Plus className="w-3 h-3" />, color: 'bg-green-500', label: 'Created' };
    case 'updated':
      return { icon: <Edit className="w-3 h-3" />, color: 'bg-blue-500', label: 'Updated' };
    case 'submitted':
      return { icon: <Clock className="w-3 h-3" />, color: 'bg-yellow-500', label: 'Submitted' };
    case 'approved':
      return { icon: <CheckCircle className="w-3 h-3" />, color: 'bg-green-500', label: 'Approved' };
    case 'rejected':
      return { icon: <XCircle className="w-3 h-3" />, color: 'bg-red-500', label: 'Rejected' };
    case 'reimbursed':
      return { icon: <DollarSign className="w-3 h-3" />, color: 'bg-green-500', label: 'Reimbursed' };
    case 'notes_added':
      return { icon: <MessageSquare className="w-3 h-3" />, color: 'bg-purple-500', label: 'Notes Added' };
    case 'receipt_added':
      return { icon: <Paperclip className="w-3 h-3" />, color: 'bg-blue-500', label: 'Receipt Attached' };
    case 'receipt_removed':
      return { icon: <Trash2 className="w-3 h-3" />, color: 'bg-red-500', label: 'Receipt Removed' };
    default:
      return { icon: <Edit className="w-3 h-3" />, color: 'bg-muted-gray', label: action };
  }
};

// Format change value for display
const formatChangeValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined) return 'N/A';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (key.includes('amount') || key.includes('rate') || key.includes('total')) {
      return `$${value.toFixed(2)}`;
    }
    return String(value);
  }
  if (typeof value === 'string') {
    // Check if it's a date
    if (key.includes('date') || key.includes('_at')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      } catch {
        // Not a date
      }
    }
    return value;
  }
  return JSON.stringify(value);
};

export const AuditLogTimeline: React.FC<AuditLogTimelineProps> = ({ entries, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-muted-gray/20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted-gray/20 rounded w-3/4" />
              <div className="h-3 bg-muted-gray/20 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-gray">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-6 bottom-6 w-px bg-muted-gray/20" />

      <div className="space-y-4">
        {entries.map((entry, index) => {
          const { icon, color, label } = getActionInfo(entry.action);
          const prevValues = entry.previous_values;
          const newValues = entry.new_values;

          // Get changed fields
          const changedFields = Object.keys(newValues).filter((key) => {
            return prevValues[key] !== newValues[key];
          });

          return (
            <div key={entry.id} className="relative flex gap-3 pl-1">
              {/* Timeline dot */}
              <div
                className={`relative z-10 w-6 h-6 rounded-full ${color} flex items-center justify-center text-white shrink-0`}
              >
                {icon}
              </div>

              {/* Content */}
              <div className="flex-1 bg-charcoal-black/30 rounded-lg p-3 border border-muted-gray/10">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {entry.user ? (
                      <>
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={entry.user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs bg-muted-gray/20">
                            {(entry.user.full_name || entry.user.username || '?')[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium text-bone-white">
                          {entry.user.full_name || entry.user.username}
                        </span>
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 text-muted-gray" />
                        <span className="text-sm text-muted-gray">System</span>
                      </>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {label}
                  </Badge>
                </div>

                {/* Show changes for updates */}
                {changedFields.length > 0 && entry.action === 'updated' && (
                  <div className="space-y-1 text-xs">
                    {changedFields.slice(0, 3).map((field) => (
                      <div key={field} className="flex items-center gap-2 text-muted-gray">
                        <span className="capitalize">{field.replace(/_/g, ' ')}:</span>
                        <span className="text-red-400 line-through">
                          {formatChangeValue(field, prevValues[field])}
                        </span>
                        <span className="text-green-400">
                          {formatChangeValue(field, newValues[field])}
                        </span>
                      </div>
                    ))}
                    {changedFields.length > 3 && (
                      <div className="text-muted-gray">
                        +{changedFields.length - 3} more changes
                      </div>
                    )}
                  </div>
                )}

                {/* Show notes for notes_added */}
                {entry.action === 'notes_added' && newValues.notes && (
                  <div className="text-sm text-muted-gray mt-1 italic">
                    "{String(newValues.notes).slice(0, 100)}
                    {String(newValues.notes).length > 100 ? '...' : ''}"
                  </div>
                )}

                {/* Show reason for rejected */}
                {entry.action === 'rejected' && newValues.reason && (
                  <div className="text-sm text-red-400 mt-1">
                    Reason: {String(newValues.reason)}
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-muted-gray mt-2">
                  {formatRelativeTime(entry.created_at)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AuditLogTimeline;
