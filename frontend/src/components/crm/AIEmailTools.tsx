import { useState } from 'react';
import { Sparkles, BarChart3, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAICompose, useAISummarize } from '@/hooks/crm/useEmail';

// ---------------------------------------------------------------------------
// AI Compose Dialog
// ---------------------------------------------------------------------------

interface AIComposeDialogProps {
  onGenerated: (html: string) => void;
}

export const AIComposeDialog = ({ onGenerated }: AIComposeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState('');
  const [tone, setTone] = useState('professional');
  const [recipientName, setRecipientName] = useState('');
  const [topic, setTopic] = useState('');

  const compose = useAICompose();

  const handleGenerate = () => {
    compose.mutate(
      {
        context: context || undefined,
        tone,
        recipient_name: recipientName || undefined,
        topic: topic || undefined,
      },
      {
        onSuccess: (data: any) => {
          const html = data?.body_html || data?.html || data || '';
          onGenerated(html);
          setOpen(false);
          setContext('');
          setTone('professional');
          setRecipientName('');
          setTopic('');
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-gray hover:text-accent-yellow gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          AI Compose
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-yellow" />
            AI Email Compose
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-gray mb-1 block">Recipient Name</label>
            <Input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. John Smith"
              className="h-8 text-sm bg-muted-gray/10 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>

          <div>
            <label className="text-xs text-muted-gray mb-1 block">Topic</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Follow up on production schedule"
              className="h-8 text-sm bg-muted-gray/10 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
            />
          </div>

          <div>
            <label className="text-xs text-muted-gray mb-1 block">Tone</label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="h-8 text-sm bg-muted-gray/10 border-muted-gray/30 text-bone-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-black border-muted-gray/30">
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-gray mb-1 block">Additional Context</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Any extra context or points to cover..."
              rows={3}
              className="w-full rounded-md text-sm bg-muted-gray/10 border border-muted-gray/30 text-bone-white placeholder:text-muted-gray p-2 resize-none focus:outline-none focus:ring-1 focus:ring-accent-yellow"
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={compose.isPending}
            className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80"
          >
            {compose.isPending ? 'Generating...' : 'Generate Email'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// AI Summarize Button
// ---------------------------------------------------------------------------

interface AISummarizeButtonProps {
  threadId: string;
}

export const AISummarizeButton = ({ threadId }: AISummarizeButtonProps) => {
  const [open, setOpen] = useState(false);
  const summarize = useAISummarize();

  const handleSummarize = () => {
    if (!summarize.data && !summarize.isPending) {
      summarize.mutate(threadId);
    }
    setOpen(true);
  };

  const summary = (summarize.data as any)?.summary || (summarize.data as string) || '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSummarize}
          disabled={summarize.isPending}
          className="text-muted-gray hover:text-accent-yellow gap-1.5"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {summarize.isPending ? 'Summarizing...' : 'Summarize'}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 bg-charcoal-black border-muted-gray/30"
        align="start"
      >
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-accent-yellow" />
          <p className="text-xs font-medium text-bone-white">AI Summary</p>
        </div>
        {summarize.isPending ? (
          <div className="py-3 text-center">
            <p className="text-xs text-muted-gray animate-pulse">Analyzing thread...</p>
          </div>
        ) : summarize.isError ? (
          <p className="text-xs text-red-400">Failed to generate summary.</p>
        ) : (
          <p className="text-sm text-muted-gray leading-relaxed whitespace-pre-wrap">{summary}</p>
        )}
      </PopoverContent>
    </Popover>
  );
};

// ---------------------------------------------------------------------------
// AI Sentiment Badge
// ---------------------------------------------------------------------------

interface AISentimentBadgeProps {
  sentiment: 'positive' | 'neutral' | 'negative';
}

const SENTIMENT_CONFIG: Record<string, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  neutral: { label: 'Neutral', className: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  negative: { label: 'Negative', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

export const AISentimentBadge = ({ sentiment }: AISentimentBadgeProps) => {
  const config = SENTIMENT_CONFIG[sentiment] || SENTIMENT_CONFIG.neutral;
  return (
    <Badge variant="outline" className={`text-xs ${config.className}`}>
      {config.label}
    </Badge>
  );
};

// ---------------------------------------------------------------------------
// Default export (all three)
// ---------------------------------------------------------------------------

const AIEmailTools = {
  AIComposeDialog,
  AISummarizeButton,
  AISentimentBadge,
};

export default AIEmailTools;
