/**
 * EditModeToolbar
 * Floating toolbar with save/cancel/reset buttons during edit mode
 */

import React, { useState } from 'react';
import { useDashboardSettings } from '@/context/DashboardSettingsContext';
import { Button } from '@/components/ui/button';
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
  Save,
  X,
  RotateCcw,
  Plus,
  Loader2,
} from 'lucide-react';

interface EditModeToolbarProps {
  onAddWidget?: () => void;
}

export function EditModeToolbar({ onAddWidget }: EditModeToolbarProps) {
  const {
    isEditing,
    hasUnsavedChanges,
    isSaving,
    saveChanges,
    discardChanges,
    resetToDefaults,
  } = useDashboardSettings();

  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  if (!isEditing) return null;

  const handleDiscard = () => {
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
    } else {
      discardChanges();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardDialog(false);
    discardChanges();
  };

  const handleReset = () => {
    setShowResetDialog(true);
  };

  const handleConfirmReset = async () => {
    setShowResetDialog(false);
    await resetToDefaults();
  };

  const handleSave = async () => {
    await saveChanges();
  };

  return (
    <>
      {/* Floating toolbar */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-charcoal-black/95 backdrop-blur-sm border border-muted-gray/30 rounded-lg shadow-lg p-2">
        {/* Add widget button */}
        {onAddWidget && (
          <Button
            variant="outline"
            size="sm"
            onClick={onAddWidget}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Widget
          </Button>
        )}

        {/* Reset button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-muted-gray hover:text-bone-white"
        >
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reset
        </Button>

        {/* Cancel button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDiscard}
          className="text-muted-gray hover:text-bone-white"
        >
          <X className="h-4 w-4 mr-1.5" />
          Cancel
        </Button>

        {/* Save button */}
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasUnsavedChanges || isSaving}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      {/* Reset confirmation dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset to Defaults?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset your dashboard to the default layout for your role.
              All your customizations will be lost. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Discard confirmation dialog */}
      <AlertDialog open={showDiscardDialog} onOpenChange={setShowDiscardDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDiscard}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
