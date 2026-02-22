import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReplyInputProps {
  onSubmit: (content: string) => void;
  placeholder?: string;
  compact?: boolean;
}

const ReplyInput = ({ onSubmit, placeholder = 'Write a reply...', compact }: ReplyInputProps) => {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content.trim());
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-2 items-end">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`flex-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm resize-none focus:border-accent-yellow focus:outline-none ${
          compact ? 'text-xs' : ''
        }`}
        rows={compact ? 2 : 3}
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!content.trim()}
        className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80 h-8"
      >
        <Send className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default ReplyInput;
