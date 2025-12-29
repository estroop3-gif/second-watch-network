/**
 * SendPackageModal - Send a document package to one or more recipients
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Send,
  Loader2,
  Search,
  User,
  Calendar,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { useBookedPeople, useSendPackage } from '@/hooks/backlot';
import {
  DocumentPackage,
  CLEARANCE_TYPE_LABELS,
} from '@/types/backlot';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';

interface SendPackageModalProps {
  projectId: string;
  package: DocumentPackage;
  open: boolean;
  onClose: () => void;
}

export function SendPackageModal({
  projectId,
  package: pkg,
  open,
  onClose,
}: SendPackageModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());
  const [dueDate, setDueDate] = useState(() => format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const sendPackage = useSendPackage();
  const { data: bookedPeople, isLoading: loadingPeople } = useBookedPeople(projectId);

  // Filter people based on package target type and search
  const filteredPeople = useMemo(() => {
    if (!bookedPeople) return [];

    let filtered = bookedPeople;

    // Filter by target type
    if (pkg.target_type === 'cast') {
      filtered = filtered.filter((p) =>
        p.roles?.some((r) => r.role_type === 'cast' || r.role_type === 'talent')
      );
    } else if (pkg.target_type === 'crew') {
      filtered = filtered.filter((p) =>
        p.roles?.some((r) => r.role_type === 'crew' || r.role_type === 'production')
      );
    }

    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.display_name?.toLowerCase().includes(query) ||
          p.full_name?.toLowerCase().includes(query) ||
          p.email?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [bookedPeople, pkg.target_type, searchQuery]);

  const toggleRecipient = (userId: string) => {
    setSelectedRecipients((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedRecipients(new Set(filteredPeople.map((p) => p.user_id)));
  };

  const deselectAll = () => {
    setSelectedRecipients(new Set());
  };

  const handleSend = async () => {
    if (selectedRecipients.size === 0) {
      toast.error('Select at least one recipient');
      return;
    }

    try {
      const result = await sendPackage.mutateAsync({
        projectId,
        package_id: pkg.id,
        recipient_user_ids: Array.from(selectedRecipients),
        due_date: dueDate || undefined,
        notes: notes.trim() || undefined,
      });

      toast.success(
        `Package sent to ${result.assignments_created} ${result.assignments_created === 1 ? 'recipient' : 'recipients'}`,
        {
          description: `${result.clearances_created} documents created`,
        }
      );

      onClose();
    } catch (err) {
      toast.error('Failed to send package', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary-red" />
            Send Package
          </DialogTitle>
          <DialogDescription>
            Send &quot;{pkg.name}&quot; to selected recipients
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Package Summary */}
          <div className="bg-muted-gray/10 rounded-lg p-3 space-y-2">
            <h4 className="text-sm font-medium text-bone-white">{pkg.name}</h4>
            {pkg.items && pkg.items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pkg.items.map((item) => (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className="text-xs"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    {item.custom_title || CLEARANCE_TYPE_LABELS[item.clearance_type]}
                    {item.is_required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date (optional)</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Add a message for recipients..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Recipients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Select Recipients</Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-xs h-7"
                >
                  Select All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAll}
                  className="text-xs h-7"
                >
                  Clear
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search people..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* People List */}
            <div className="border border-muted-gray/30 rounded-lg max-h-60 overflow-y-auto">
              {loadingPeople ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : filteredPeople.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  {searchQuery
                    ? 'No people match your search'
                    : 'No booked people available'}
                </div>
              ) : (
                <div className="divide-y divide-muted-gray/20">
                  {filteredPeople.map((person) => (
                    <label
                      key={person.user_id}
                      className={cn(
                        'flex items-center gap-3 p-3 cursor-pointer hover:bg-muted-gray/10 transition-colors',
                        selectedRecipients.has(person.user_id) && 'bg-primary-red/10'
                      )}
                    >
                      <Checkbox
                        checked={selectedRecipients.has(person.user_id)}
                        onCheckedChange={() => toggleRecipient(person.user_id)}
                      />
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted-gray/30 flex items-center justify-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-bone-white truncate">
                            {person.display_name || person.full_name || 'Unknown'}
                          </p>
                          {person.roles && person.roles.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              {person.roles.map((r) => r.role_name).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                      {selectedRecipients.has(person.user_id) && (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {selectedRecipients.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedRecipients.size} {selectedRecipients.size === 1 ? 'recipient' : 'recipients'} selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sendPackage.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendPackage.isPending || selectedRecipients.size === 0}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            {sendPackage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Send className="h-4 w-4 mr-2" />
            Send Package
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
