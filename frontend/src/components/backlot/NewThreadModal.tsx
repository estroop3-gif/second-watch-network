import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';
import { withUpgradeGate } from '@/utils/withUpgradeGate';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';

const threadSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters long.'),
  body: z.string().min(10, 'Body must be at least 10 characters long.'),
  category_id: z.string().uuid('Please select a category.'),
  tags: z.string().optional(),
  is_anonymous: z.boolean().default(false),
});

type ThreadFormData = z.infer<typeof threadSchema>;

const fetchCategories = async () => {
  const { data, error } = await supabase.from('forum_categories').select('id, name');
  if (error) throw new Error(error.message);
  return data;
};

interface NewThreadModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export const NewThreadModal = ({ isOpen, onOpenChange }: NewThreadModalProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const form = useForm<ThreadFormData>({
    resolver: zodResolver(threadSchema),
    defaultValues: {
      title: '',
      body: '',
      is_anonymous: false,
    },
  });

  const { data: categories, isLoading: isLoadingCategories } = useQuery({
    queryKey: ['forum_categories_list'],
    queryFn: fetchCategories,
  });

  const createThreadMutation = useMutation({
    mutationFn: withUpgradeGate(hasPermission, 'forum_post', async (newThread: ThreadFormData) => {
      if (!user) throw new Error('You must be logged in to create a thread.');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('You must be logged in to create a thread.');
      const tagsArray = newThread.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [];
      const { error } = await supabase.from('forum_threads').insert({
        user_id: currentUser.id,
        title: newThread.title,
        body: newThread.body,
        category_id: newThread.category_id,
        tags: tagsArray,
        is_anonymous: newThread.is_anonymous,
      });
      if (error) throw error;
    }),
    onSuccess: async () => {
      toast.success('Thread created successfully!');
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      if ((error as any)?.code === 'UPGRADE_REQUIRED' || (error as Error).message === 'UPGRADE_REQUIRED') {
        toast.error('Premium required to post in the forum.');
      } else {
        toast.error(`Failed to create thread: ${(error as Error).message}`);
      }
    },
  });

  const onSubmit = (data: ThreadFormData) => {
    createThreadMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px] bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle>Start a New Thread</DialogTitle>
          <DialogDescription>
            Share your thoughts, ask a question, or start a collaboration.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="What's on your mind?" {...field} className="bg-muted-gray/20 border-muted-gray" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-muted-gray/20 border-muted-gray">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
                      {isLoadingCategories ? (
                        <SelectItem value="loading" disabled>Loading...</SelectItem>
                      ) : (
                        categories?.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Elaborate here..." rows={8} {...field} className="bg-muted-gray/20 border-muted-gray" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional, comma-separated)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., cinematography, arri, davinci-resolve" {...field} className="bg-muted-gray/20 border-muted-gray" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_anonymous"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-muted-gray p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Post Anonymously</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createThreadMutation.isPending} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
                {createThreadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post Thread
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};