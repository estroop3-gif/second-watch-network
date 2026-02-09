import { useState } from 'react';
import { usePipeline } from '@/hooks/crm/useDeals';
import { useCreateDeal } from '@/hooks/crm/useDeals';
import { useContacts } from '@/hooks/crm';
import { usePermissions } from '@/hooks/usePermissions';
import PipelineBoard from '@/components/crm/PipelineBoard';
import PipelineStats from '@/components/crm/PipelineStats';
import DealForm from '@/components/crm/DealForm';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { Plus, BarChart3 } from 'lucide-react';

const Pipeline = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin']);

  const [productFilter, setProductFilter] = useState<string>('all');
  const [showStats, setShowStats] = useState(false);
  const [showCreateDeal, setShowCreateDeal] = useState(false);

  const { data, isLoading } = usePipeline(
    productFilter !== 'all' ? { product_type: productFilter } : undefined
  );
  const { data: contactsData } = useContacts({ limit: 200 });
  const createDeal = useCreateDeal();
  const { toast } = useToast();
  const { openCompose } = useEmailCompose();

  const handleEmail = (deal: any) => {
    openCompose({
      defaultTo: deal.contact_email,
      contactId: deal.contact_id,
      defaultSubject: deal.title,
      contactData: {
        first_name: deal.contact_first_name,
        last_name: deal.contact_last_name,
        company: deal.contact_company,
        email: deal.contact_email,
        deal_name: deal.title,
      },
    });
  };

  const handleCreateDeal = async (formData: any) => {
    try {
      await createDeal.mutateAsync(formData);
      toast({ title: 'Deal created' });
      setShowCreateDeal(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to create deal', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow">Pipeline</h1>
          <p className="text-muted-gray mt-1">Manage your sales pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStats(!showStats)}
            className="border-muted-gray text-bone-white"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            {showStats ? 'Hide Stats' : 'Show Stats'}
          </Button>
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="w-44 bg-charcoal-black border-muted-gray text-bone-white">
              <SelectValue placeholder="All Products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Products</SelectItem>
              <SelectItem value="backlot_membership">Backlot</SelectItem>
              <SelectItem value="premium_membership">Premium</SelectItem>
              <SelectItem value="production_service">Production</SelectItem>
              <SelectItem value="gear_rental">Gear Rental</SelectItem>
              <SelectItem value="ad_deal">Ad Deal</SelectItem>
              <SelectItem value="sponsorship">Sponsorship</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => setShowCreateDeal(true)}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Deal
          </Button>
        </div>
      </div>

      {showStats && <PipelineStats />}

      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading pipeline...</div>
      ) : (
        <PipelineBoard pipeline={data?.pipeline || {}} onEmail={handleEmail} />
      )}

      <Dialog open={showCreateDeal} onOpenChange={setShowCreateDeal}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <DealForm
            contacts={contactsData?.contacts || []}
            onSubmit={handleCreateDeal}
            isLoading={createDeal.isPending}
            onCancel={() => setShowCreateDeal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Pipeline;
