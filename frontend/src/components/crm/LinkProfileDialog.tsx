import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface LinkProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  onLink: (profileId: string) => void;
  isLinking?: boolean;
}

const LinkProfileDialog = ({ open, onOpenChange, contactId, onLink, isLinking }: LinkProfileDialogProps) => {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const data = await api.get<any[]>(`/api/v1/profiles/search?q=${encodeURIComponent(search)}&limit=10`);
      setResults(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to search profiles');
    }
    setSearching(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Link to SWN Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className="bg-charcoal-black border-muted-gray"
            />
            <Button onClick={handleSearch} disabled={searching} variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {results.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/20 hover:border-accent-yellow/30"
              >
                <div>
                  <div className="text-sm font-medium text-bone-white">{p.full_name || p.username}</div>
                  <div className="text-xs text-muted-gray">{p.email}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isLinking}
                  onClick={() => onLink(p.id)}
                  className="text-accent-yellow"
                >
                  <Link2 className="h-4 w-4 mr-1" /> Link
                </Button>
              </div>
            ))}
            {results.length === 0 && search && !searching && (
              <p className="text-center text-sm text-muted-gray py-4">No profiles found</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkProfileDialog;
