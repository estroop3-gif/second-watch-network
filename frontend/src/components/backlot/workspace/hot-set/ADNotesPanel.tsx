/**
 * ADNotesPanel - Auto-saving notes textarea for 1st AD
 *
 * Features:
 * - Debounced auto-save (1 second delay)
 * - Visual save status indicator
 * - Persists notes to session
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, StickyNote, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpdateSessionNotes } from '@/hooks/backlot';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ADNotesPanelProps {
  sessionId: string;
  initialNotes: string | null;
  canEdit: boolean;
  className?: string;
}

export const ADNotesPanel: React.FC<ADNotesPanelProps> = ({
  sessionId,
  initialNotes,
  canEdit,
  className,
}) => {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedNotes = useRef(initialNotes || '');

  const updateNotes = useUpdateSessionNotes();

  // Sync initial notes when they change externally
  useEffect(() => {
    if (initialNotes !== null && initialNotes !== lastSavedNotes.current) {
      setNotes(initialNotes);
      lastSavedNotes.current = initialNotes;
    }
  }, [initialNotes]);

  // Debounced save function
  const saveNotes = useCallback(async (value: string) => {
    if (value === lastSavedNotes.current) {
      return; // No change to save
    }

    setSaveStatus('saving');
    try {
      await updateNotes.mutateAsync({ sessionId, notes: value });
      lastSavedNotes.current = value;
      setSaveStatus('saved');

      // Reset to idle after showing "saved" for 2 seconds
      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    } catch (error) {
      console.error('Failed to save notes:', error);
      setSaveStatus('error');

      // Reset to idle after showing error for 3 seconds
      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
  }, [sessionId, updateNotes]);

  // Handle text change with debounced save
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }

    // Set new timeout for auto-save (1 second delay)
    saveTimeoutRef.current = setTimeout(() => {
      saveNotes(value);
    }, 1000);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  const statusIndicator = () => {
    switch (saveStatus) {
      case 'saving':
        return (
          <Badge variant="outline" className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Saving...
          </Badge>
        );
      case 'saved':
        return (
          <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/30 text-green-400">
            <Check className="w-3 h-3 mr-1" />
            Saved
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="outline" className="text-xs bg-red-500/10 border-red-500/30 text-red-400">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error saving
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardHeader className="py-3 px-4 border-b border-muted-gray/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-accent-yellow" />
            AD Notes
          </CardTitle>
          {statusIndicator()}
        </div>
      </CardHeader>
      <CardContent className="p-3">
        <Textarea
          value={notes}
          onChange={handleChange}
          placeholder={canEdit ? "Add notes for this production day..." : "No notes yet"}
          disabled={!canEdit}
          className={cn(
            'min-h-[120px] bg-charcoal-black border-muted-gray/30 resize-none',
            'placeholder:text-muted-gray/50',
            !canEdit && 'opacity-60 cursor-not-allowed'
          )}
        />
        <p className="text-xs text-muted-gray mt-2">
          Notes auto-save as you type
        </p>
      </CardContent>
    </Card>
  );
};
