import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Send, Loader2, AlertTriangle, FileText, Paperclip, X, Clock, Sparkles, MoreHorizontal } from 'lucide-react';
import { useSendEmail, useEmailTemplates, useUploadEmailAttachment, useAICompose } from '@/hooks/crm/useEmail';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import RichTextEditor from './RichTextEditor';
import EmailToAutocomplete from './EmailToAutocomplete';

interface EmailComposerProps {
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultCc?: string;
  threadId?: string;
  contactId?: string;
  isDNC?: boolean;
  contactData?: {
    first_name?: string;
    last_name?: string;
    company?: string;
    email?: string;
    deal_name?: string;
  };
  quotedHtml?: string;
  quotedLabel?: string;
  onSent?: (threadId: string) => void;
  onCancel?: () => void;
  compact?: boolean;
}

function interpolateVariables(text: string, vars: Record<string, string | undefined>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => vars[key] || match);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EmailComposer = ({
  defaultTo, defaultSubject, defaultBody, defaultCc, threadId, contactId,
  isDNC, contactData, quotedHtml, quotedLabel, onSent, onCancel, compact,
}: EmailComposerProps) => {
  const [to, setTo] = useState(defaultTo || '');
  const [cc, setCc] = useState(defaultCc || '');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [bodyHtml, setBodyHtml] = useState(defaultBody || '');
  const [attachments, setAttachments] = useState<{ id: string; filename: string; size_bytes: number }[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [resolvedContactId, setResolvedContactId] = useState<string | null>(null);
  const [aiTone, setAiTone] = useState('professional');
  const [aiTopic, setAiTopic] = useState('');
  const [showQuotedText, setShowQuotedText] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();
  const { profile } = useAuth();
  const sendEmail = useSendEmail();
  const { data: templatesData } = useEmailTemplates();
  const uploadAttachment = useUploadEmailAttachment();
  const aiCompose = useAICompose();
  const templates = templatesData?.templates || [];

  const handleTemplateSelect = (templateId: string) => {
    if (templateId === 'none') return;
    const template = templates.find((t: any) => t.id === templateId);
    if (!template) return;

    const vars: Record<string, string | undefined> = {
      first_name: contactData?.first_name,
      last_name: contactData?.last_name,
      company: contactData?.company,
      email: contactData?.email || to,
      deal_name: contactData?.deal_name,
      rep_name: profile?.full_name,
      rep_email: profile?.email,
      rep_phone: profile?.phone || '',
      rep_title: 'Sales Representative',
      company_name: 'Second Watch Network',
    };

    setSubject(interpolateVariables(template.subject, vars));
    setBodyHtml(interpolateVariables(template.body_html, vars));
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: 'File too large', description: `${file.name} exceeds 10MB limit`, variant: 'destructive' });
        continue;
      }
      try {
        const att = await uploadAttachment.mutateAsync(file);
        setAttachments(prev => [...prev, { id: att.id, filename: att.filename, size_bytes: att.size_bytes }]);
      } catch (err: any) {
        toast({ title: 'Upload failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      }
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, []);

  const handleSend = (scheduled?: boolean) => {
    if (!to || !subject || !bodyHtml || bodyHtml === '<p></p>') {
      toast({ title: 'Missing fields', description: 'To, subject, and body are required.', variant: 'destructive' });
      return;
    }

    const ccList = cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : undefined;

    // Append quoted text to body if present
    let finalBodyHtml = bodyHtml;
    if (quotedHtml) {
      finalBodyHtml += `<br><br><blockquote style="border-left: 2px solid #ccc; padding-left: 12px; margin-left: 8px; color: #888;">` +
        (quotedLabel ? `<p style="font-size: 12px; color: #999;">${quotedLabel}</p>` : '') +
        quotedHtml +
        `</blockquote>`;
    }

    // Convert HTML to plain text preserving paragraph breaks
    let bodyText = finalBodyHtml.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    bodyText = bodyText.replace(/<br\s*\/?>/gi, '\n');
    bodyText = bodyText.replace(/<\/(div|h[1-6]|li|tr)>/gi, '\n');
    bodyText = bodyText.replace(/<[^>]+>/g, '');
    bodyText = bodyText.trim();

    sendEmail.mutate({
      contact_id: resolvedContactId || contactId,
      to_email: to,
      subject,
      body_html: finalBodyHtml,
      body_text: bodyText,
      cc: ccList,
      thread_id: threadId,
      attachment_ids: attachments.length > 0 ? attachments.map(a => a.id) : undefined,
      scheduled_at: scheduled && scheduleDate ? new Date(scheduleDate).toISOString() : undefined,
    }, {
      onSuccess: (data) => {
        const title = scheduled ? 'Email scheduled' : data.internal ? 'Message delivered internally' : 'Email sent';
        toast({ title });
        setBodyHtml('');
        setAttachments([]);
        setScheduleDate('');
        setShowSchedule(false);
        setResolvedContactId(null);
        if (!threadId) { setTo(''); setCc(''); setSubject(''); }
        onSent?.(data.thread_id);
      },
      onError: (err: any) => {
        toast({ title: 'Failed to send', description: err?.message || 'Unknown error', variant: 'destructive' });
      },
    });
  };

  const handleAICompose = () => {
    aiCompose.mutate({
      tone: aiTone,
      topic: aiTopic || subject || undefined,
      recipient_name: contactData?.first_name || to.split('@')[0] || undefined,
      context: contactData ? `Company: ${contactData.company || 'N/A'}, Deal: ${contactData.deal_name || 'N/A'}` : undefined,
    }, {
      onSuccess: (data) => {
        setBodyHtml(data.body_html);
        toast({ title: 'AI draft generated' });
      },
      onError: (err: any) => {
        toast({ title: 'AI compose failed', description: err?.message || 'Unknown error', variant: 'destructive' });
      },
    });
  };

  if (isDNC) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span>This contact is flagged as Do Not Email. Sending is blocked.</span>
      </div>
    );
  }

  return (
    <div
      className={compact ? 'space-y-3' : 'space-y-4'}
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      {!threadId && (
        <>
          <div>
            <Label className="text-bone-white/70 text-xs">To</Label>
            <EmailToAutocomplete
              value={to}
              onChange={setTo}
              onSelect={(s) => { if (s.contact_id) setResolvedContactId(s.contact_id); }}
            />
          </div>
          <div>
            <Label className="text-bone-white/70 text-xs">CC (comma separated)</Label>
            <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com"
              className="bg-charcoal-black border-muted-gray/50 text-bone-white" />
          </div>
          <div>
            <Label className="text-bone-white/70 text-xs">Subject</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject"
              className="bg-charcoal-black border-muted-gray/50 text-bone-white" />
          </div>
        </>
      )}

      {/* Template picker */}
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-gray flex-shrink-0" />
        {templates.length > 0 ? (
          <Select onValueChange={handleTemplateSelect}>
            <SelectTrigger className="bg-charcoal-black border-muted-gray/50 text-bone-white text-sm h-8">
              <SelectValue placeholder="Use a template..." />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t: any) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.category !== 'general' && <span className="text-muted-gray">[{t.category}] </span>}
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-gray">No templates available</span>
        )}
      </div>

      <div>
        {!compact && <Label className="text-bone-white/70 text-xs mb-1 block">Message</Label>}
        <RichTextEditor content={bodyHtml} onChange={setBodyHtml}
          placeholder={compact ? 'Write your reply...' : 'Compose your email...'} compact={compact} />
      </div>

      {/* Quoted text section */}
      {quotedHtml && (
        <div>
          <button
            type="button"
            onClick={() => setShowQuotedText(!showQuotedText)}
            className="flex items-center gap-1 text-muted-gray hover:text-bone-white transition-colors"
            title={showQuotedText ? 'Hide quoted text' : 'Show quoted text'}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="text-xs">{showQuotedText ? 'Hide' : 'Show'} quoted text</span>
          </button>
          {showQuotedText && (
            <div className="mt-2 border-l-2 border-muted-gray/40 pl-3 max-h-[200px] overflow-y-auto">
              {quotedLabel && (
                <p className="text-xs text-muted-gray mb-1">{quotedLabel}</p>
              )}
              <div
                className="text-xs text-muted-gray/80 [&_a]:text-accent-yellow/60"
                dangerouslySetInnerHTML={{ __html: quotedHtml }}
              />
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2 px-2 py-1 rounded bg-muted-gray/10 border border-muted-gray/30 text-xs text-bone-white/80">
              <Paperclip className="h-3 w-3" />
              <span className="truncate max-w-[120px]">{att.filename}</span>
              <span className="text-muted-gray">({formatFileSize(att.size_bytes)})</span>
              <button onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} className="text-muted-gray hover:text-red-400">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button onClick={() => handleSend(false)}
            disabled={sendEmail.isPending || !to || !subject || !bodyHtml || bodyHtml === '<p></p>'}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {sendEmail.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {threadId ? 'Reply' : 'Send'}
          </Button>

          {/* Schedule send */}
          <Popover open={showSchedule} onOpenChange={setShowSchedule}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-gray" title="Schedule send">
                <Clock className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 bg-charcoal-black border-muted-gray/50">
              <div className="space-y-3">
                <p className="text-sm font-medium text-bone-white">Schedule Send</p>
                <Input type="datetime-local" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                  className="bg-muted-gray/10 border-muted-gray/50 text-bone-white text-sm" />
                <div className="flex gap-1 flex-wrap">
                  {['In 1 hour', 'In 3 hours', 'Tomorrow 9 AM'].map(preset => (
                    <Button key={preset} variant="ghost" size="sm" className="text-xs text-muted-gray h-6"
                      onClick={() => {
                        const now = new Date();
                        if (preset === 'In 1 hour') now.setHours(now.getHours() + 1);
                        else if (preset === 'In 3 hours') now.setHours(now.getHours() + 3);
                        else { now.setDate(now.getDate() + 1); now.setHours(9, 0, 0, 0); }
                        setScheduleDate(now.toISOString().slice(0, 16));
                      }}
                    >{preset}</Button>
                  ))}
                </div>
                <Button onClick={() => handleSend(true)} disabled={!scheduleDate} size="sm"
                  className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 text-xs">
                  <Clock className="h-3 w-3 mr-1" />Schedule
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Attachment upload */}
          <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} className="text-muted-gray" title="Attach file">
            <Paperclip className="h-4 w-4" />
          </Button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => handleFileUpload(e.target.files)} />

          {/* AI Compose */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-gray" title="AI Compose"
                disabled={aiCompose.isPending}>
                {aiCompose.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-charcoal-black border-muted-gray/50">
              <div className="space-y-3">
                <p className="text-sm font-medium text-bone-white">AI Compose</p>
                <Select value={aiTone} onValueChange={setAiTone}>
                  <SelectTrigger className="h-8 text-xs bg-muted-gray/10 border-muted-gray/50 text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="formal">Formal</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={aiTopic} onChange={e => setAiTopic(e.target.value)} placeholder="Topic / context..."
                  className="h-8 text-xs bg-muted-gray/10 border-muted-gray/50 text-bone-white" />
                <Button onClick={handleAICompose} disabled={aiCompose.isPending} size="sm"
                  className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90 text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />Generate Draft
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="text-muted-gray">Cancel</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailComposer;
