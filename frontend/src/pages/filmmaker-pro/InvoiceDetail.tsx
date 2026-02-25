/**
 * Invoice Detail — View, edit, send, and manage a single invoice.
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Send, CheckCircle, Trash2, Plus, Copy } from 'lucide-react';
import {
  useInvoice,
  useCreateInvoice,
  useUpdateInvoice,
  useSendInvoice,
  useMarkInvoicePaid,
  useDeleteInvoice,
} from '@/hooks/useFilmmakerPro';
import { useToast } from '@/hooks/use-toast';

const InvoiceDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isNew = id === 'new';

  const { data: invoice, isLoading } = useInvoice(isNew ? '' : id || '');
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  const sendMutation = useSendInvoice();
  const paidMutation = useMarkInvoicePaid();
  const deleteMutation = useDeleteInvoice();

  const [form, setForm] = useState({
    recipient_name: '',
    recipient_email: '',
    recipient_company: '',
    project_name: '',
    due_date: '',
    tax_rate_percent: 0,
    notes: '',
    line_items: [{ description: '', quantity: 1, unit_price_cents: 0, rate_type: 'flat' as string, sort_order: 0 }],
  });

  const [isEditing, setIsEditing] = useState(isNew);

  // Populate form when invoice loads
  if (invoice && !isNew && !isEditing && form.recipient_name === '' && invoice.recipient_name) {
    setForm({
      recipient_name: invoice.recipient_name || '',
      recipient_email: invoice.recipient_email || '',
      recipient_company: invoice.recipient_company || '',
      project_name: invoice.project_name || '',
      due_date: invoice.due_date || '',
      tax_rate_percent: invoice.tax_rate_percent || 0,
      notes: invoice.notes || '',
      line_items: invoice.line_items?.length > 0
        ? invoice.line_items.map((li: any, i: number) => ({
            description: li.description,
            quantity: li.quantity,
            unit_price_cents: li.unit_price_cents / 100,
            rate_type: li.rate_type,
            sort_order: i,
          }))
        : [{ description: '', quantity: 1, unit_price_cents: 0, rate_type: 'flat', sort_order: 0 }],
    });
  }

  const addLineItem = () => {
    setForm({
      ...form,
      line_items: [...form.line_items, { description: '', quantity: 1, unit_price_cents: 0, rate_type: 'flat', sort_order: form.line_items.length }],
    });
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const items = [...form.line_items];
    (items[index] as any)[field] = value;
    setForm({ ...form, line_items: items });
  };

  const removeLineItem = (index: number) => {
    setForm({ ...form, line_items: form.line_items.filter((_, i) => i !== index) });
  };

  const subtotal = form.line_items.reduce((sum, li) => sum + (Number(li.unit_price_cents) * li.quantity), 0);
  const tax = subtotal * (form.tax_rate_percent / 100);
  const total = subtotal + tax;

  const handleSave = async () => {
    const payload = {
      ...form,
      line_items: form.line_items.map((li, i) => ({
        ...li,
        unit_price_cents: Math.round(Number(li.unit_price_cents) * 100),
        sort_order: i,
      })),
    };

    try {
      if (isNew) {
        const result = await createMutation.mutateAsync(payload);
        toast({ title: 'Invoice created' });
        navigate(`/filmmaker-pro/invoices/${result.id}`, { replace: true });
      } else {
        await updateMutation.mutateAsync({ id, ...form });
        toast({ title: 'Invoice updated' });
        setIsEditing(false);
      }
    } catch {
      toast({ title: 'Error saving invoice', variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    try {
      await sendMutation.mutateAsync(id!);
      toast({ title: 'Invoice sent' });
    } catch {
      toast({ title: 'Error sending invoice', variant: 'destructive' });
    }
  };

  const handleMarkPaid = async () => {
    try {
      await paidMutation.mutateAsync({ id: id! });
      toast({ title: 'Invoice marked as paid' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id!);
      toast({ title: 'Invoice deleted' });
      navigate('/filmmaker-pro/invoices');
    } catch {
      toast({ title: 'Error deleting invoice', variant: 'destructive' });
    }
  };

  const copyViewLink = () => {
    if (invoice?.view_token) {
      navigator.clipboard.writeText(`${window.location.origin}/invoice/${invoice.view_token}`);
      toast({ title: 'View link copied' });
    }
  };

  if (!isNew && isLoading) return <p className="text-muted-gray text-center py-12">Loading...</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/filmmaker-pro/invoices')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-heading text-bone-white">
          {isNew ? 'New Invoice' : invoice?.invoice_number || 'Invoice'}
        </h1>
        {invoice?.status && (
          <Badge className={
            invoice.status === 'paid' ? 'bg-green-600' :
            invoice.status === 'sent' ? 'bg-blue-600' :
            invoice.status === 'overdue' ? 'bg-red-600' :
            'bg-muted-gray'
          }>
            {invoice.status}
          </Badge>
        )}
      </div>

      {/* Actions */}
      {!isNew && !isEditing && (
        <div className="flex gap-2 flex-wrap">
          {invoice?.status === 'draft' && (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>Edit</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSend} disabled={sendMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />Send
              </Button>
              <Button variant="destructive" onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
            </>
          )}
          {['sent', 'viewed'].includes(invoice?.status) && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleMarkPaid}>
              <CheckCircle className="h-4 w-4 mr-2" />Mark Paid
            </Button>
          )}
          {invoice?.view_token && (
            <Button variant="outline" onClick={copyViewLink}><Copy className="h-4 w-4 mr-2" />Copy Link</Button>
          )}
        </div>
      )}

      {/* Form / Display */}
      <Card className="bg-charcoal-black border-muted-gray">
        <CardHeader>
          <CardTitle className="text-bone-white">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-bone-white">Recipient Name *</Label>
              <Input value={form.recipient_name} disabled={!isEditing && !isNew}
                onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div>
              <Label className="text-bone-white">Recipient Email</Label>
              <Input value={form.recipient_email} disabled={!isEditing && !isNew}
                onChange={(e) => setForm({ ...form, recipient_email: e.target.value })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div>
              <Label className="text-bone-white">Company</Label>
              <Input value={form.recipient_company} disabled={!isEditing && !isNew}
                onChange={(e) => setForm({ ...form, recipient_company: e.target.value })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div>
              <Label className="text-bone-white">Project</Label>
              <Input value={form.project_name} disabled={!isEditing && !isNew}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div>
              <Label className="text-bone-white">Due Date</Label>
              <Input type="date" value={form.due_date} disabled={!isEditing && !isNew}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
            <div>
              <Label className="text-bone-white">Tax Rate (%)</Label>
              <Input type="number" value={form.tax_rate_percent} disabled={!isEditing && !isNew}
                onChange={(e) => setForm({ ...form, tax_rate_percent: Number(e.target.value) })}
                className="bg-muted-gray/20 border-muted-gray text-bone-white" />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <Label className="text-bone-white mb-2 block">Line Items</Label>
            <div className="space-y-2">
              {form.line_items.map((li, i) => (
                <div key={i} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Input placeholder="Description" value={li.description} disabled={!isEditing && !isNew}
                      onChange={(e) => updateLineItem(i, 'description', e.target.value)}
                      className="bg-muted-gray/20 border-muted-gray text-bone-white" />
                  </div>
                  <div className="w-20">
                    <Input type="number" placeholder="Qty" value={li.quantity} disabled={!isEditing && !isNew}
                      onChange={(e) => updateLineItem(i, 'quantity', Number(e.target.value))}
                      className="bg-muted-gray/20 border-muted-gray text-bone-white" />
                  </div>
                  <div className="w-28">
                    <Input type="number" placeholder="Rate ($)" value={li.unit_price_cents} disabled={!isEditing && !isNew}
                      onChange={(e) => updateLineItem(i, 'unit_price_cents', Number(e.target.value))}
                      className="bg-muted-gray/20 border-muted-gray text-bone-white" />
                  </div>
                  <p className="text-sm text-bone-white w-24 text-right">${(Number(li.unit_price_cents) * li.quantity).toFixed(2)}</p>
                  {(isEditing || isNew) && form.line_items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeLineItem(i)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {(isEditing || isNew) && (
              <Button variant="ghost" size="sm" className="mt-2 text-amber-400" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-1" />Add Item
              </Button>
            )}
          </div>

          {/* Totals */}
          <div className="border-t border-muted-gray pt-4 space-y-1 text-right">
            <p className="text-sm text-muted-gray">Subtotal: <span className="text-bone-white">${subtotal.toFixed(2)}</span></p>
            {form.tax_rate_percent > 0 && (
              <p className="text-sm text-muted-gray">Tax ({form.tax_rate_percent}%): <span className="text-bone-white">${tax.toFixed(2)}</span></p>
            )}
            <p className="text-lg font-bold text-amber-400">Total: ${total.toFixed(2)}</p>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-bone-white">Notes</Label>
            <Textarea value={form.notes} disabled={!isEditing && !isNew}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Payment terms, thank you note, etc."
              className="bg-muted-gray/20 border-muted-gray text-bone-white" />
          </div>

          {(isEditing || isNew) && (
            <div className="flex gap-2">
              <Button className="bg-amber-500 hover:bg-amber-600 text-charcoal-black" onClick={handleSave}
                disabled={!form.recipient_name || form.line_items.length === 0 || createMutation.isPending || updateMutation.isPending}>
                {isNew ? 'Create Invoice' : 'Save Changes'}
              </Button>
              {!isNew && <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvoiceDetail;
