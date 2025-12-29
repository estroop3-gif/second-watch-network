import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from '@/components/ui/button';
import { Loader2, Ban, EyeOff, MessageSquareOff, XCircle } from 'lucide-react';

const forumBanSchema = z.object({
  restriction_type: z.enum(['read_only', 'full_block', 'shadow_restrict']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
  details: z.string().optional(),
  duration_hours: z.number().min(0),
});

type ForumBanFormValues = z.infer<typeof forumBanSchema>;

interface ForumBanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  onSuccess?: () => void;
}

const RESTRICTION_TYPES = [
  {
    value: 'read_only',
    label: 'Read Only',
    description: 'User can view content but cannot post threads or replies',
    icon: MessageSquareOff,
    color: 'text-yellow-500',
  },
  {
    value: 'full_block',
    label: 'Full Block',
    description: 'User cannot access the forum at all',
    icon: XCircle,
    color: 'text-red-500',
  },
  {
    value: 'shadow_restrict',
    label: 'Shadow Restrict',
    description: "User's posts are only visible to themselves and admins",
    icon: EyeOff,
    color: 'text-orange-500',
  },
];

const DURATION_OPTIONS = [
  { value: 0, label: 'Permanent' },
  { value: 1, label: '1 hour' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
  { value: 720, label: '30 days' },
  { value: 2160, label: '90 days' },
];

const ForumBanDialog: React.FC<ForumBanDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}) => {
  const queryClient = useQueryClient();

  const form = useForm<ForumBanFormValues>({
    resolver: zodResolver(forumBanSchema),
    defaultValues: {
      restriction_type: 'read_only',
      reason: '',
      details: '',
      duration_hours: 0,
    },
  });

  const createBanMutation = useMutation({
    mutationFn: (data: ForumBanFormValues) => api.createForumBan(userId, data),
    onSuccess: () => {
      toast.success(`Forum ban applied to ${userName}`);
      queryClient.invalidateQueries({ queryKey: ['admin-forum-bans'] });
      queryClient.invalidateQueries({ queryKey: ['admin-community'] });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to apply forum ban');
    },
  });

  const onSubmit = (values: ForumBanFormValues) => {
    createBanMutation.mutate(values);
  };

  const selectedType = RESTRICTION_TYPES.find(t => t.value === form.watch('restriction_type'));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" />
            Ban User from Forum
          </DialogTitle>
          <DialogDescription>
            Apply a forum-specific ban to <span className="font-semibold text-white">{userName}</span>.
            This will not affect their access to other platform features.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="restriction_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Restriction Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select restriction type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {RESTRICTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <type.icon className={`h-4 w-4 ${type.color}`} />
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedType && (
                    <FormDescription className="text-xs">
                      {selectedType.description}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="duration_hours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration</FormLabel>
                  <Select
                    onValueChange={(v) => field.onChange(parseInt(v))}
                    defaultValue={field.value.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DURATION_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value.toString()}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Explain why this user is being banned..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    This will be shown to the user
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Additional notes for admins..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={createBanMutation.isPending}
              >
                {createBanMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Apply Ban
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ForumBanDialog;
