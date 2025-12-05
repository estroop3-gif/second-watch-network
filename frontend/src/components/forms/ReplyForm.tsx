import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2 } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { UpgradeGateButton } from '@/components/upgrade/UpgradeGate';
import { withUpgradeGate } from '@/utils/withUpgradeGate';

const replySchema = z.object({
  body: z.string().min(1, 'Reply cannot be empty.').max(5000, 'Reply is too long.'),
});

type ReplyFormData = z.infer<typeof replySchema>;

interface ReplyFormProps {
  threadId: string;
}

export const ReplyForm = ({ threadId }: ReplyFormProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canReply = hasPermission('forum_reply');

  const form = useForm<ReplyFormData>({
    resolver: zodResolver(replySchema),
    defaultValues: {
      body: '',
    },
  });

  const replyMutation = useMutation({
    mutationFn: withUpgradeGate(hasPermission, 'forum_reply', async (newReply: ReplyFormData) => {
      if (!user) throw new Error('You must be logged in to reply.');
      const { error } = await supabase.from('forum_replies').insert({
        thread_id: threadId,
        user_id: user.id,
        body: newReply.body,
      });
      if (error) throw error;
    }),
    onSuccess: () => {
      toast.success('Reply posted!');
      queryClient.invalidateQueries({ queryKey: ['thread_replies', threadId] });
      form.reset();
    },
    onError: (error) => {
      if ((error as any)?.code === 'UPGRADE_REQUIRED' || (error as Error).message === 'UPGRADE_REQUIRED') {
        toast.error('Premium required to reply in the forum.');
      } else {
        toast.error(`Failed to post reply: ${(error as Error).message}`);
      }
    },
  });

  const onSubmit = (data: ReplyFormData) => {
    replyMutation.mutate(data);
  };

  if (!canReply) {
    return (
      <div className="space-y-4 mt-8">
        <Textarea
          disabled
          placeholder="Go Premium to reply..."
          rows={5}
          className="bg-muted-gray/20 border-muted-gray text-bone-white opacity-60"
        />
        <div className="flex justify-end">
          <UpgradeGateButton requiredPerm="forum_reply" onClickAllowed={() => { /* no-op, gated users will see modal */ }}>
            <Button type="button" className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              Go Premium to Reply
            </Button>
          </UpgradeGateButton>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-8">
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Leave a reply..."
                  rows={5}
                  {...field}
                  className="bg-muted-gray/20 border-muted-gray text-bone-white"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={replyMutation.isPending} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
            {replyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Post Reply
          </Button>
        </div>
      </form>
    </Form>
  );
};