import { useState } from 'react';
import { Plus, Edit, Trash2, FileText, Eye, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  useEmailTemplates, useCreateEmailTemplate,
  useUpdateEmailTemplate, useDeleteEmailTemplate,
} from '@/hooks/crm/useEmail';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from '@/components/crm/RichTextEditor';

const CATEGORIES = ['general', 'follow-up', 'introduction', 'proposal', 'closing', 'support'];
const PLACEHOLDERS = [
  '{{first_name}}', '{{last_name}}', '{{company}}', '{{email}}', '{{deal_name}}',
  '{{rep_name}}', '{{rep_email}}', '{{rep_phone}}', '{{rep_title}}', '{{company_name}}',
];

const EmailTemplates = () => {
  const { hasAnyRole } = usePermissions();
  const isAdmin = hasAnyRole(['admin', 'superadmin', 'sales_admin']);
  const { toast } = useToast();

  const { data, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  // Form state
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [category, setCategory] = useState('general');

  const templates = data?.templates || [];

  const resetForm = () => {
    setName('');
    setSubject('');
    setBodyHtml('');
    setCategory('general');
    setEditingTemplate(null);
  };

  const openCreate = () => {
    resetForm();
    setShowEditor(true);
  };

  const openEdit = (template: any) => {
    setEditingTemplate(template);
    setName(template.name);
    setSubject(template.subject);
    setBodyHtml(template.body_html);
    setCategory(template.category || 'general');
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!name || !subject || !bodyHtml) {
      toast({ title: 'Missing fields', description: 'Name, subject, and body are required.', variant: 'destructive' });
      return;
    }

    // Extract placeholders used in the template
    const usedPlaceholders: string[] = [];
    const regex = /\{\{(\w+)\}\}/g;
    let match;
    const fullText = subject + bodyHtml;
    while ((match = regex.exec(fullText)) !== null) {
      if (!usedPlaceholders.includes(match[1])) {
        usedPlaceholders.push(match[1]);
      }
    }

    const payload = {
      name,
      subject,
      body_html: bodyHtml,
      category,
      placeholders: usedPlaceholders,
    };

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, data: payload });
        toast({ title: 'Template updated' });
      } else {
        await createTemplate.mutateAsync(payload);
        toast({ title: 'Template created' });
      }
      setShowEditor(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (template: any) => {
    if (!confirm(`Deactivate template "${template.name}"?`)) return;
    try {
      await deleteTemplate.mutateAsync(template.id);
      toast({ title: 'Template deactivated' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const insertPlaceholder = (ph: string) => {
    setBodyHtml(prev => prev + ph);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12 text-muted-gray">
        Admin access required to manage email templates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <FileText className="h-8 w-8" />
            Email Templates
          </h1>
          <p className="text-muted-gray mt-1">
            Manage email templates for sales reps
          </p>
        </div>
        <Button
          onClick={openCreate}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading templates...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-gray/30 mx-auto mb-3" />
          <p className="text-muted-gray">No templates yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template: any) => (
            <div
              key={template.id}
              className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 hover:border-muted-gray/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-sm font-medium text-bone-white">{template.name}</h3>
                    <Badge variant="outline" className="border-muted-gray/30 text-muted-gray text-xs">
                      {template.category}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-gray mb-2">Subject: {template.subject}</p>
                  {template.placeholders?.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {template.placeholders.map((p: string) => (
                        <span key={p} className="text-xs px-1.5 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow/70">
                          {`{{${p}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => setPreviewTemplate(template)}
                    className="p-1.5 rounded text-muted-gray hover:text-bone-white hover:bg-muted-gray/20 transition-colors"
                    title="Preview"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => openEdit(template)}
                    className="p-1.5 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(template)}
                    className="p-1.5 rounded text-muted-gray hover:text-red-400 hover:bg-red-400/10 transition-colors"
                    title="Deactivate"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showEditor} onOpenChange={(open) => { if (!open) { setShowEditor(false); resetForm(); } }}>
        <DialogContent className="max-w-3xl bg-charcoal-black border-muted-gray/50 max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-accent-yellow">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-6 pt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-bone-white/70 text-xs">Template Name</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Initial Outreach"
                  className="bg-charcoal-black border-muted-gray/50 text-bone-white"
                />
              </div>
              <div>
                <Label className="text-bone-white/70 text-xs">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-charcoal-black border-muted-gray/50 text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-bone-white/70 text-xs">Subject Line</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Introducing Second Watch Network to {{company}}"
                className="bg-charcoal-black border-muted-gray/50 text-bone-white"
              />
            </div>

            {/* Placeholder buttons */}
            <div>
              <Label className="text-bone-white/70 text-xs mb-1 block">Insert Variable</Label>
              <div className="flex gap-1.5 flex-wrap">
                {PLACEHOLDERS.map(ph => (
                  <button
                    key={ph}
                    type="button"
                    onClick={() => insertPlaceholder(ph)}
                    className="text-xs px-2 py-1 rounded border border-accent-yellow/30 text-accent-yellow/70 hover:bg-accent-yellow/10 transition-colors"
                  >
                    {ph}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-bone-white/70 text-xs mb-1 block">Body</Label>
              <RichTextEditor
                content={bodyHtml}
                onChange={setBodyHtml}
                placeholder="Write your template content..."
                minHeight="250px"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowEditor(false); resetForm(); }}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={createTemplate.isPending || updateTemplate.isPending || !name || !subject || !bodyHtml}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {(createTemplate.isPending || updateTemplate.isPending) ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl bg-charcoal-black border-muted-gray/50">
          <DialogHeader>
            <DialogTitle className="text-bone-white">{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-gray text-xs">Subject</Label>
              <p className="text-bone-white text-sm mt-1">{previewTemplate?.subject}</p>
            </div>
            <div>
              <Label className="text-muted-gray text-xs">Body</Label>
              <div
                className="mt-2 p-4 rounded-lg border border-muted-gray/30 bg-white text-charcoal-black text-sm prose max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0"
                dangerouslySetInnerHTML={{ __html: previewTemplate?.body_html || '' }}
              />
            </div>
            {previewTemplate?.placeholders?.length > 0 && (
              <div>
                <Label className="text-muted-gray text-xs">Variables Used</Label>
                <div className="flex gap-1.5 mt-1 flex-wrap">
                  {previewTemplate.placeholders.map((p: string) => (
                    <span key={p} className="text-xs px-2 py-0.5 rounded bg-accent-yellow/10 text-accent-yellow">
                      {`{{${p}}}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplates;
