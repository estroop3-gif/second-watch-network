import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRMLeads } from '@/hooks/crm/useDeals';
import DealCard from '@/components/crm/DealCard';
import LeadAssignmentDialog from '@/components/crm/LeadAssignmentDialog';
import { Button } from '@/components/ui/button';
import { UserPlus, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

const DealLeads = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [assigningDeal, setAssigningDeal] = useState<any>(null);

  const { data, isLoading } = useCRMLeads({ limit: 100 });
  const leads = data?.leads || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-gray">
          {data?.total || 0} unassigned deal leads
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => qc.invalidateQueries({ queryKey: ['crm-leads'] })}
          className="border-muted-gray text-bone-white"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading leads...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-gray">No unassigned deal leads right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead: any) => (
            <div key={lead.id} className="relative group">
              <DealCard deal={lead} onClick={() => navigate(`/crm/deals/${lead.id}`)} />
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity border-accent-yellow text-accent-yellow"
                onClick={(e) => {
                  e.stopPropagation();
                  setAssigningDeal(lead);
                }}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1" />
                Assign
              </Button>
            </div>
          ))}
        </div>
      )}

      {assigningDeal && (
        <LeadAssignmentDialog
          deal={assigningDeal}
          open={!!assigningDeal}
          onOpenChange={(open) => !open && setAssigningDeal(null)}
        />
      )}
    </div>
  );
};

export default DealLeads;
