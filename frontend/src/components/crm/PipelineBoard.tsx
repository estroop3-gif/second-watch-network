import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DealCard from './DealCard';
import DealForm from './DealForm';
import { useChangeDealStage, useUpdateDeal } from '@/hooks/crm/useDeals';
import { useContacts } from '@/hooks/crm';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const STAGE_CONFIG = [
  { key: 'lead', label: 'Lead', color: 'border-slate-500' },
  { key: 'contacted', label: 'Contacted', color: 'border-blue-500' },
  { key: 'qualified', label: 'Qualified', color: 'border-indigo-500' },
  { key: 'proposal', label: 'Proposal', color: 'border-purple-500' },
  { key: 'negotiation', label: 'Negotiation', color: 'border-amber-500' },
  { key: 'closed_won', label: 'Closed Won', color: 'border-emerald-500' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'border-red-500' },
];

interface PipelineBoardProps {
  pipeline: Record<string, any[]>;
  onEmail?: (deal: any) => void;
}

const PipelineBoard = ({ pipeline, onEmail }: PipelineBoardProps) => {
  const navigate = useNavigate();
  const changeStage = useChangeDealStage();
  const updateDeal = useUpdateDeal();
  const { data: contactsData } = useContacts({ limit: 200 });
  const { toast } = useToast();
  const [editingDeal, setEditingDeal] = useState<any>(null);

  const handleStageChange = (dealId: string, newStage: string) => {
    changeStage.mutate({ id: dealId, data: { stage: newStage } });
  };

  const handleEditSubmit = async (formData: any) => {
    if (!editingDeal) return;
    try {
      await updateDeal.mutateAsync({ id: editingDeal.id, data: formData });
      toast({ title: 'Deal updated' });
      setEditingDeal(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update deal', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: '400px' }}>
        {STAGE_CONFIG.map(({ key, label, color }) => {
          const deals = pipeline[key] || [];
          const stageValue = deals.reduce((sum: number, d: any) => sum + (d.amount_cents || 0), 0);

          return (
            <div
              key={key}
              className={`flex-shrink-0 w-72 bg-charcoal-black/50 rounded-lg border-t-2 ${color}`}
            >
              <div className="p-3 border-b border-muted-gray/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-bone-white">{label}</h3>
                  <span className="text-xs bg-muted-gray/30 text-bone-white px-2 py-0.5 rounded-full">
                    {deals.length}
                  </span>
                </div>
                {stageValue > 0 && (
                  <p className="text-xs text-muted-gray mt-1">
                    ${(stageValue / 100).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
                {deals.length === 0 ? (
                  <p className="text-xs text-muted-gray text-center py-4">No deals</p>
                ) : (
                  deals.map((deal: any) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      compact
                      onClick={() => navigate(`/crm/deals/${deal.id}`)}
                      onStageChange={handleStageChange}
                      onEdit={setEditingDeal}
                      onEmail={onEmail}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editingDeal} onOpenChange={(open) => !open && setEditingDeal(null)}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Edit Deal</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-6 pt-4">
            {editingDeal && (
              <DealForm
                initialData={editingDeal}
                contacts={contactsData?.contacts || []}
                onSubmit={handleEditSubmit}
                isLoading={updateDeal.isPending}
                onCancel={() => setEditingDeal(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PipelineBoard;
