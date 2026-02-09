import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAssignDeal, useCRMLeads } from '@/hooks/crm/useDeals';
import { useCRMReps } from '@/hooks/crm';
import { useToast } from '@/hooks/use-toast';
import { UserPlus } from 'lucide-react';

interface LeadAssignmentDialogProps {
  deal: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LeadAssignmentDialog = ({ deal, open, onOpenChange }: LeadAssignmentDialogProps) => {
  const [selectedRep, setSelectedRep] = useState('');
  const { data: repsData } = useCRMReps();
  const assignDeal = useAssignDeal();
  const { toast } = useToast();

  const handleAssign = async () => {
    if (!selectedRep) return;
    try {
      await assignDeal.mutateAsync({ dealId: deal.id, repId: selectedRep });
      toast({ title: 'Deal assigned', description: `Deal "${deal.title}" has been assigned.` });
      onOpenChange(false);
      setSelectedRep('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to assign deal', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-accent-yellow" />
            Assign Deal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-gray">Deal</p>
            <p className="text-sm font-medium text-bone-white">{deal?.title}</p>
          </div>

          <div>
            <label className="text-sm text-muted-gray block mb-2">Assign to Rep</label>
            <Select value={selectedRep} onValueChange={setSelectedRep}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                <SelectValue placeholder="Select a rep" />
              </SelectTrigger>
              <SelectContent>
                {(repsData?.reps || []).map((rep: any) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.full_name || rep.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedRep || assignDeal.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {assignDeal.isPending ? 'Assigning...' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadAssignmentDialog;
