import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const SubmissionNotesModal = ({ submission, isOpen, onClose }: { submission: any, isOpen: boolean, onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [adminNotes, setAdminNotes] = useState(submission?.admin_notes || '');

  useEffect(() => {
    if (submission) {
      setAdminNotes(submission.admin_notes || '');
    }
  }, [submission]);

  const saveNotesMutation = useMutation({
    mutationFn: async (notes: string) => {
      const { error } = await supabase
        .from('submissions')
        .update({ admin_notes: notes })
        .eq('id', submission.id);
      if (error) throw new Error(error.message);
      return notes;
    },
    onSuccess: () => {
      toast.success("Admin notes saved.");
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to save notes: ${error.message}`);
    },
  });

  const handleSaveNotes = () => {
    saveNotesMutation.mutate(adminNotes);
  };

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl text-accent-yellow">Notes for: {submission.project_title}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-2">
          <Label htmlFor="admin-notes" className="font-bold text-lg">Internal Notes</Label>
          <Textarea
            id="admin-notes"
            placeholder="Add internal notes for the team..."
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            className="bg-charcoal-black border-muted-gray min-h-[200px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSaveNotes} disabled={saveNotesMutation.isPending} className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
            {saveNotesMutation.isPending ? 'Saving...' : 'Save Notes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};