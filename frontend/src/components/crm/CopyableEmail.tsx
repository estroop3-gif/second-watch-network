import { useToast } from '@/hooks/use-toast';
import { Copy } from 'lucide-react';

interface CopyableEmailProps {
  email: string;
  className?: string;
}

const CopyableEmail = ({ email, className }: CopyableEmailProps) => {
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(email).then(() => {
      toast({ title: 'Copied', description: `${email} copied to clipboard` });
    });
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 hover:text-accent-yellow transition-colors group ${className || ''}`}
      title="Click to copy"
    >
      <span>{email}</span>
      <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
};

export default CopyableEmail;
