/**
 * ADNotesPanel - Auto-saving notes textarea for 1st AD with publish workflow
 *
 * Features:
 * - Debounced auto-save to draft (1 second delay)
 * - Manual "Save Note" button to publish
 * - Visual draft/save status indicators
 * - Version history support
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, StickyNote, AlertCircle, Save, FileEdit } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useAdNoteDraft,
  useSaveAdNoteDraft,
  usePublishAdNote,
} from '@/hooks/backlot/useAdNotes';
import { toast } from 'sonner';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'publishing' | 'published';

interface ADNotesPanelProps {
  dayId: string;
  initialNotes: string | null;
  canEdit: boolean;
  className?: string;
}

export const ADNotesPanel: React.FC<ADNotesPanelProps> = ({
  dayId,
  initialNotes,
  canEdit,
  className,
}) => {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [hasDraftChanges, setHasDraftChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDraft = useRef(initialNotes || '');
  const initialLoadRef = useRef(true);

  // Hooks for draft and publish
  const { data: draft, isLoading: isDraftLoading } = useAdNoteDraft(dayId);
  const saveDraft = useSaveAdNoteDraft();
  const publishNote = usePublishAdNote();

  // Initialize with draft content if available
  useEffect(() => {
    if (initialLoadRef.current && draft?.content) {
      setNotes(draft.content);
      lastSavedDraft.current = draft.content;
      setHasDraftChanges(true);
      initialLoadRef.current = false;
    } else if (initialLoadRef.current && initialNotes) {
      setNotes(initialNotes);
      lastSavedDraft.current = initialNotes;
      initialLoadRef.current = false;
    }
  }, [draft, initialNotes]);

  // Reset initial load flag when dayId changes
  useEffect(() => {
    initialLoadRef.current = true;
    setHasDraftChanges(false);
    setSaveStatus('idle');
  }, [dayId]);

  // Debounced save draft function
  const saveDraftContent = useCallback(
    async (value: string) => {
      if (value === lastSavedDraft.current) {
        return;
      }

      setSaveStatus('saving');
      try {
        await saveDraft.mutateAsync({ dayId, content: value });
        lastSavedDraft.current = value;
        setHasDraftChanges(true);
        setSaveStatus('saved');

        savedTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch (error) {
        console.error('Failed to save draft:', error);
        setSaveStatus('error');

        savedTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      }
    },
    [dayId, saveDraft]
  );

  // Handle text change with debounced draft save
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNotes(value);

    // Clear existing timeouts
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedTimeoutRef.current) {
      clearTimeout(savedTimeoutRef.current);
    }

    // Set new timeout for auto-save draft (1 second delay)
    saveTimeoutRef.current = setTimeout(() => {
      saveDraftContent(value);
    }, 1000);
  };

  // Publish note
  const handlePublish = async () => {
    if (!notes.trim()) {
      toast.error('Cannot save empty note');
      return;
    }

    // Clear any pending draft save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('publishing');
    try {
      await publishNote.mutateAsync({ dayId, content: notes });
      setHasDraftChanges(false);
      lastSavedDraft.current = notes;
      setSaveStatus('published');
      toast.success('Note saved to history');

      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Failed to publish note:', error);
      setSaveStatus('error');
      toast.error('Failed to save note');

      savedTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
    }
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
          <Badge
            variant="outline"
            className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400"
          >
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Saving draft...
          </Badge>
        );
      case 'saved':
        return (
          <Badge
            variant="outline"
            className="text-xs bg-blue-500/10 border-blue-500/30 text-blue-400"
          >
            <Check className="w-3 h-3 mr-1" />
            Draft saved
          </Badge>
        );
      case 'publishing':
        return (
          <Badge
            variant="outline"
            className="text-xs bg-accent-yellow/10 border-accent-yellow/30 text-accent-yellow"
          >
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            Saving...
          </Badge>
        );
      case 'published':
        return (
          <Badge
            variant="outline"
            className="text-xs bg-green-500/10 border-green-500/30 text-green-400"
          >
            <Check className="w-3 h-3 mr-1" />
            Saved
          </Badge>
        );
      case 'error':
        return (
          <Badge
            variant="outline"
            className="text-xs bg-red-500/10 border-red-500/30 text-red-400"
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        if (hasDraftChanges) {
          return (
            <Badge
              variant="outline"
              className="text-xs bg-orange-500/10 border-orange-500/30 text-orange-400"
            >
              <FileEdit className="w-3 h-3 mr-1" />
              Draft
            </Badge>
          );
        }
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
          placeholder={canEdit ? 'Add notes for this production day...' : 'No notes yet'}
          disabled={!canEdit || isDraftLoading}
          className={cn(
            'min-h-[120px] bg-charcoal-black border-muted-gray/30 resize-none',
            'placeholder:text-muted-gray/50',
            !canEdit && 'opacity-60 cursor-not-allowed'
          )}
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-muted-gray">
            {hasDraftChanges ? 'Draft auto-saves as you type' : 'Notes auto-save as you type'}
          </p>
          {canEdit && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={
                publishNote.isPending ||
                saveStatus === 'publishing' ||
                !notes.trim()
              }
              className="h-8"
            >
              {publishNote.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Save Note
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
