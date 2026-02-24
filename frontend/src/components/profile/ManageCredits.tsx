import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, PlusCircle, Trash2, Edit, X } from 'lucide-react';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AccountSection } from '@/components/account/AccountSection';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import PositionSelector, { Position, POSITIONS } from '@/components/shared/PositionSelector';
import ProductionSelector, { ProductionItem } from '@/components/shared/ProductionSelector';

const creditSchema = z.object({
  position: z.string().min(1, "Position is required."),
  productionTitle: z.string().min(1, "Production title is required."),
  productionId: z.string().optional(),
  description: z.string().max(250, "Description must be 250 characters or less.").optional(),
  productionDate: z.string().optional(),
});

type CreditFormValues = z.infer<typeof creditSchema>;

const CreditForm = ({ onSave, existingCredit, closeModal }: { onSave: (data: CreditFormValues, creditId?: string) => void, existingCredit?: any, closeModal: () => void }) => {
  // Build initial position from existing credit
  const existingPosition = existingCredit?.position || existingCredit?.role || "";
  const matchedPosition = POSITIONS.find(
    p => p.name.toLowerCase() === existingPosition.toLowerCase()
  );

  // Build initial production from existing credit
  const existingProdTitle = existingCredit?.productions?.title || existingCredit?.title || "";
  const existingProdId = existingCredit?.production_id || existingCredit?.productions?.id || null;

  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(
    matchedPosition?.id || null
  );
  const [selectedProductionId, setSelectedProductionId] = useState<string | null>(
    existingProdId
  );

  const form = useForm<CreditFormValues>({
    resolver: zodResolver(creditSchema),
    defaultValues: {
      position: existingPosition,
      productionTitle: existingProdTitle,
      productionId: existingProdId || undefined,
      description: existingCredit?.description || "",
      productionDate: existingCredit?.production_date
        ? new Date(existingCredit.production_date).toISOString().split('T')[0]
        : existingCredit?.year
          ? `${existingCredit.year}-01-01`
          : "",
    },
  });

  const onSubmit = (data: CreditFormValues) => {
    onSave(data, existingCredit?.id);
    closeModal();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="position" render={({ field }) => (
          <FormItem>
            <FormLabel>Position</FormLabel>
            <FormControl>
              <PositionSelector
                value={selectedPositionId}
                onChange={(id, position) => {
                  setSelectedPositionId(id);
                  field.onChange(position?.name || '');
                }}
                initialSelectedItem={matchedPosition || (existingPosition ? {
                  id: 'custom-' + existingPosition,
                  name: existingPosition,
                  department: 'Other',
                } : null)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="productionTitle" render={({ field }) => (
          <FormItem>
            <FormLabel>Production</FormLabel>
            <FormControl>
              <ProductionSelector
                value={selectedProductionId}
                onChange={(id, production) => {
                  setSelectedProductionId(id);
                  form.setValue('productionId', id || undefined);
                  field.onChange(production?.name || '');
                }}
                initialSelectedItem={existingProdId ? {
                  id: existingProdId,
                  name: existingProdTitle,
                } as ProductionItem : null}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="productionDate" render={({ field }) => (
          <FormItem><FormLabel>Production Date (Optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="A short description of your role or the project." {...field} /></FormControl><FormMessage /></FormItem>
        )} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={closeModal}>Cancel</Button>
          <Button type="submit">Save Credit</Button>
        </div>
      </form>
    </Form>
  );
};

const ManageCredits = ({ initialCredits, onCreditsUpdate }: { initialCredits: any[], onCreditsUpdate: () => void }) => {
  const { profileId } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCredit, setEditingCredit] = useState<any | null>(null);

  const handleSaveCredit = async (data: CreditFormValues, creditId?: string) => {
    if (!profileId) return;
    setIsSubmitting(true);

    try {
      const creditPayload: any = {
        position: data.position,
        production_title: data.productionTitle,
        description: data.description,
        production_date: data.productionDate || undefined,
      };

      // Include production_id if a known production was selected
      if (data.productionId) {
        creditPayload.production_id = data.productionId;
      }

      if (creditId) {
        // Update existing credit
        await api.updateCredit(creditId, profileId, creditPayload);
        toast.success('Credit updated successfully!');
      } else {
        // Create new credit
        await api.createCredit(profileId, creditPayload);
        toast.success('Credit added successfully!');
      }

      onCreditsUpdate();
    } catch (error: any) {
      toast.error(`Failed to save credit: ${error.message}`);
    } finally {
      setIsSubmitting(false);
      setIsModalOpen(false);
      setEditingCredit(null);
    }
  };

  const handleDeleteCredit = async (creditId: string) => {
    try {
      await api.deleteCredit(creditId);
      toast.success("Credit deleted.");
      onCreditsUpdate();
    } catch (error: any) {
      toast.error(`Failed to delete credit: ${error.message}`);
    }
  };

  return (
    <AccountSection title="Credits">
      <div className="flex justify-end mb-4">
        <Dialog open={isModalOpen} onOpenChange={(isOpen) => {
          if (!isOpen) setEditingCredit(null);
          setIsModalOpen(isOpen);
        }}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditingCredit(null)}><PlusCircle className="mr-2 h-4 w-4" /> Add Credit</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingCredit ? 'Edit' : 'Add'} Credit</DialogTitle></DialogHeader>
            <CreditForm onSave={handleSaveCredit} existingCredit={editingCredit} closeModal={() => setIsModalOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="space-y-4">
        {initialCredits.length === 0 ? (
          <p className="text-muted-gray text-sm text-center py-4">No credits added yet.</p>
        ) : (
          initialCredits.map((credit) => (
            <div key={credit.id} className="flex items-center justify-between p-3 bg-charcoal-black/50 rounded-md border border-muted-gray/20">
              <div>
                <p className="font-semibold">{credit.position || credit.role || 'Credit'}</p>
                <p className="text-sm text-muted-gray">
                  {credit.productions?.title || credit.title || 'Unknown Production'}
                  {(credit.production_date || credit.year) && ` (${credit.year || new Date(credit.production_date).getFullYear()})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" size="icon" onClick={() => { setEditingCredit(credit); setIsModalOpen(true); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this credit.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCredit(credit.id)} className="bg-primary-red hover:bg-red-700">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))
        )}
      </div>
    </AccountSection>
  );
};

export default ManageCredits;
