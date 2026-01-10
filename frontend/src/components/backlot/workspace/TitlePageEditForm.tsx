/**
 * TitlePageEditForm - Form for editing screenplay title page data
 *
 * Provides fields for: title, authors, based on credit, contact info, draft info, copyright
 * Includes a live preview panel showing the rendered title page
 */
import React, { useState, useEffect } from 'react';
import { TitlePageData, TitlePageContact, TitlePageDraftInfo } from '@/types/backlot';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { ScriptTitlePage } from './ScriptTitlePage';

interface TitlePageEditFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData: TitlePageData | null;
  onSave: (data: TitlePageData) => Promise<void>;
  isSaving?: boolean;
}

export const TitlePageEditForm: React.FC<TitlePageEditFormProps> = ({
  open,
  onOpenChange,
  initialData,
  onSave,
  isSaving = false,
}) => {
  // Form state
  const [title, setTitle] = useState('');
  const [writtenBy, setWrittenBy] = useState<string[]>(['']);
  const [basedOn, setBasedOn] = useState('');
  const [contact, setContact] = useState<TitlePageContact>({});
  const [draftInfo, setDraftInfo] = useState<TitlePageDraftInfo>({});
  const [copyright, setCopyright] = useState('');

  // Initialize form when dialog opens
  useEffect(() => {
    if (open && initialData) {
      setTitle(initialData.title || '');
      setWrittenBy(initialData.written_by?.length ? initialData.written_by : ['']);
      setBasedOn(initialData.based_on || '');
      setContact(initialData.contact || {});
      setDraftInfo(initialData.draft_info || {});
      setCopyright(initialData.copyright || '');
    } else if (open && !initialData) {
      // Reset to defaults
      setTitle('');
      setWrittenBy(['']);
      setBasedOn('');
      setContact({});
      setDraftInfo({});
      setCopyright('');
    }
  }, [open, initialData]);

  // Build preview data
  const previewData: TitlePageData = {
    title: title || undefined,
    written_by: writtenBy.filter((a) => a.trim()) || undefined,
    based_on: basedOn || undefined,
    contact: Object.keys(contact).some((k) => contact[k as keyof TitlePageContact])
      ? contact
      : undefined,
    draft_info: Object.keys(draftInfo).some((k) => draftInfo[k as keyof TitlePageDraftInfo])
      ? draftInfo
      : undefined,
    copyright: copyright || undefined,
  };

  const handleAddAuthor = () => {
    setWrittenBy([...writtenBy, '']);
  };

  const handleRemoveAuthor = (index: number) => {
    setWrittenBy(writtenBy.filter((_, i) => i !== index));
  };

  const handleAuthorChange = (index: number, value: string) => {
    const newAuthors = [...writtenBy];
    newAuthors[index] = value;
    setWrittenBy(newAuthors);
  };

  const handleSave = async () => {
    // Clean up data before saving
    const cleanData: TitlePageData = {};

    if (title.trim()) cleanData.title = title.trim();

    const cleanAuthors = writtenBy.filter((a) => a.trim());
    if (cleanAuthors.length) cleanData.written_by = cleanAuthors;

    if (basedOn.trim()) cleanData.based_on = basedOn.trim();

    const cleanContact: TitlePageContact = {};
    if (contact.name?.trim()) cleanContact.name = contact.name.trim();
    if (contact.company?.trim()) cleanContact.company = contact.company.trim();
    if (contact.address?.trim()) cleanContact.address = contact.address.trim();
    if (contact.phone?.trim()) cleanContact.phone = contact.phone.trim();
    if (contact.email?.trim()) cleanContact.email = contact.email.trim();
    if (Object.keys(cleanContact).length) cleanData.contact = cleanContact;

    const cleanDraft: TitlePageDraftInfo = {};
    if (draftInfo.date?.trim()) cleanDraft.date = draftInfo.date.trim();
    if (draftInfo.revision?.trim()) cleanDraft.revision = draftInfo.revision.trim();
    if (Object.keys(cleanDraft).length) cleanData.draft_info = cleanDraft;

    if (copyright.trim()) cleanData.copyright = copyright.trim();

    await onSave(cleanData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-2">
          <DialogTitle>Edit Title Page</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* Form Panel - Compact layout */}
          <div className="w-[55%] overflow-y-auto pr-3 space-y-4">
            {/* Title & Authors Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-sm font-medium">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="The screenplay title"
                />
              </div>

              {/* Based On */}
              <div className="space-y-1.5">
                <Label htmlFor="basedOn" className="text-sm font-medium">Based On</Label>
                <Input
                  id="basedOn"
                  value={basedOn}
                  onChange={(e) => setBasedOn(e.target.value)}
                  placeholder="Based on the novel by..."
                />
              </div>
            </div>

            {/* Authors */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Written By</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddAuthor}
                  className="h-7 px-2 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {writtenBy.map((author, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={author}
                      onChange={(e) => handleAuthorChange(index, e.target.value)}
                      placeholder={`Author ${index + 1}`}
                      className="h-9"
                    />
                    {writtenBy.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveAuthor(index)}
                        className="h-9 w-9 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Information - Compact grid */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
              <Label className="text-sm font-medium">Contact Information</Label>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                <Input
                  value={contact.name || ''}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                  placeholder="Contact name"
                  className="h-8 text-sm"
                />
                <Input
                  value={contact.company || ''}
                  onChange={(e) => setContact({ ...contact, company: e.target.value })}
                  placeholder="Company"
                  className="h-8 text-sm"
                />
                <Input
                  value={contact.phone || ''}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                  placeholder="Phone"
                  className="h-8 text-sm"
                />
                <Input
                  value={contact.email || ''}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                  placeholder="Email"
                  className="h-8 text-sm"
                />
                <div className="col-span-2">
                  <Input
                    value={contact.address || ''}
                    onChange={(e) => setContact({ ...contact, address: e.target.value })}
                    placeholder="Address (use commas for line breaks)"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Draft Info & Copyright Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="draftRevision" className="text-xs text-muted-foreground">
                  Draft
                </Label>
                <Input
                  id="draftRevision"
                  value={draftInfo.revision || ''}
                  onChange={(e) => setDraftInfo({ ...draftInfo, revision: e.target.value })}
                  placeholder="Second Draft"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="draftDate" className="text-xs text-muted-foreground">
                  Date
                </Label>
                <Input
                  id="draftDate"
                  value={draftInfo.date || ''}
                  onChange={(e) => setDraftInfo({ ...draftInfo, date: e.target.value })}
                  placeholder="January 2025"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="copyright" className="text-xs text-muted-foreground">
                  Copyright
                </Label>
                <Input
                  id="copyright"
                  value={copyright}
                  onChange={(e) => setCopyright(e.target.value)}
                  placeholder="© 2025 Name"
                  className="h-8 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Preview Panel - Scaled to fit */}
          <div className="w-[45%] bg-muted/50 rounded-lg p-3 flex flex-col">
            <div className="text-xs text-muted-foreground mb-2 text-center font-medium">
              Preview
            </div>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              {/* Container maintains aspect ratio, scaled down to fit */}
              <div
                className="relative bg-white shadow-lg origin-top"
                style={{
                  width: '306px',  // 612px / 2 = 50% scale
                  height: '396px', // 792px / 2 = 50% scale
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
              >
                <ScriptTitlePage
                  data={previewData}
                  className="w-full h-full"
                  zoom={50}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TitlePageEditForm;
