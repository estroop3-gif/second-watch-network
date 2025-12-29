import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Pencil, Loader2, MessageSquare, Flag, MessageCircle, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

// Import tab components
import ThreadsAdminTab from '@/components/admin/community/ThreadsAdminTab';
import CommentsAdminTab from '@/components/admin/community/CommentsAdminTab';
import ReportsAdminTab from '@/components/admin/community/ReportsAdminTab';

// Types for community tables
interface CommunityTopic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
  thread_count?: number;
  created_at?: string;
  updated_at?: string;
}

const slugify = (text: string) =>
  text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

// Topic Form Schema
const topicFormSchema = z.object({
  name: z.string().min(3, { message: "Topic name must be at least 3 characters." }),
  description: z.string().max(200, { message: "Description must be 200 characters or less." }).optional(),
  icon: z.string().optional(),
  is_active: z.boolean().default(true),
});

type TopicFormValues = z.infer<typeof topicFormSchema>;

// Topic Edit/Create Dialog
const TopicDialog = ({ topic, children }: { topic?: CommunityTopic, children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<TopicFormValues>({
    resolver: zodResolver(topicFormSchema),
    defaultValues: {
      name: topic?.name || "",
      description: topic?.description || "",
      icon: topic?.icon || "",
      is_active: topic?.is_active ?? true,
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        name: topic?.name || "",
        description: topic?.description || "",
        icon: topic?.icon || "",
        is_active: topic?.is_active ?? true,
      });
    }
  }, [isOpen, topic, form]);

  const onSubmit = async (values: TopicFormValues) => {
    const slug = slugify(values.name);
    try {
      if (topic) {
        await api.updateCommunityTopicAdmin(topic.id, { ...values, slug });
      } else {
        await api.createCommunityTopicAdmin({ ...values, slug });
      }
      toast.success(`Topic ${topic ? 'updated' : 'created'} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['admin-community-topics'] });
      setIsOpen(false);
    } catch (error: any) {
      toast.error(`Failed to save topic: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{topic ? 'Edit' : 'Create'} Topic</DialogTitle>
          <DialogDescription>
            {topic ? 'Update the details for this topic.' : 'Create a new topic for community discussions.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topic Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Cinematography" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="A short description of the topic." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon (emoji or icon name)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., camera" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-gray">Allow new threads in this topic</p>
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
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Topic'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

// Topics Tab Component
const TopicsTab = () => {
  const queryClient = useQueryClient();
  const { data: topics, isLoading, error } = useQuery({
    queryKey: ['admin-community-topics'],
    queryFn: () => api.listCommunityTopicsAdmin(),
  });

  const handleDeleteTopic = async (topicId: string) => {
    try {
      await api.deleteCommunityTopicAdmin(topicId);
      toast.success("Topic has been deleted.");
      queryClient.invalidateQueries({ queryKey: ['admin-community-topics'] });
    } catch (error: any) {
      toast.error(`Failed to delete topic: ${error.message}`);
    }
  };

  if (error) toast.error(`Failed to fetch topics: ${(error as Error).message}`);

  const topicsList = topics || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-white">Forum Topics</h2>
        <TopicDialog>
          <Button>Create Topic</Button>
        </TopicDialog>
      </div>
      <div className="rounded-md border border-zinc-800">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900/50">
              <TableHead className="text-zinc-400">Icon</TableHead>
              <TableHead className="text-zinc-400">Name</TableHead>
              <TableHead className="text-zinc-400">Description</TableHead>
              <TableHead className="text-zinc-400">Threads</TableHead>
              <TableHead className="text-zinc-400">Status</TableHead>
              <TableHead className="text-zinc-400">Created At</TableHead>
              <TableHead className="text-zinc-400 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center h-48">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={7} className="text-center h-48 text-red-500">Error: {(error as Error).message}</TableCell></TableRow>
            ) : topicsList.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center h-48 text-zinc-500">No topics found</TableCell></TableRow>
            ) : topicsList.map((topic: CommunityTopic) => (
              <TableRow key={topic.id} className="border-zinc-800 hover:bg-zinc-900/50">
                <TableCell className="text-2xl">{topic.icon || 'forum'}</TableCell>
                <TableCell className="font-medium text-white">
                  <Link to={`/filmmakers?tab=topics&topic=${topic.slug}`} className="hover:underline">
                    {topic.name}
                  </Link>
                </TableCell>
                <TableCell className="max-w-md text-sm text-zinc-400 line-clamp-2">{topic.description || '-'}</TableCell>
                <TableCell className="text-zinc-400">{topic.thread_count ?? 0}</TableCell>
                <TableCell>
                  <Badge variant={topic.is_active ? "default" : "secondary"} className={topic.is_active ? "bg-green-600" : ""}>
                    {topic.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className="text-zinc-400">{format(new Date(topic.created_at || new Date()), 'MMM dd, yyyy')}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <TopicDialog topic={topic}>
                      <Button type="button" variant="ghost" size="icon" className="text-yellow-500 hover:text-yellow-400">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TopicDialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this topic and all its threads. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteTopic(topic.id)} className="bg-red-600 hover:bg-red-700">
                            Delete Topic
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

// Main Forum Management Page with Tabs
const ForumManagement = () => {
  const [activeTab, setActiveTab] = useState('topics');

  // Get report stats for badge
  const { data: reportStats } = useQuery({
    queryKey: ['admin-report-stats'],
    queryFn: () => api.getReportStats(),
  });

  const pendingReports = reportStats?.pending || 0;

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Community <span className="font-spray text-accent-yellow">Forum</span>
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-zinc-900 border-zinc-800 mb-6">
          <TabsTrigger value="topics" className="data-[state=active]:bg-zinc-800 gap-2">
            <FolderOpen className="h-4 w-4" />
            Topics
          </TabsTrigger>
          <TabsTrigger value="threads" className="data-[state=active]:bg-zinc-800 gap-2">
            <MessageSquare className="h-4 w-4" />
            Threads
          </TabsTrigger>
          <TabsTrigger value="comments" className="data-[state=active]:bg-zinc-800 gap-2">
            <MessageCircle className="h-4 w-4" />
            Comments
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-zinc-800 gap-2 relative">
            <Flag className="h-4 w-4" />
            Reports
            {pendingReports > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5 text-xs px-1.5">
                {pendingReports}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="topics" className="mt-0">
          <TopicsTab />
        </TabsContent>

        <TabsContent value="threads" className="mt-0">
          <ThreadsAdminTab />
        </TabsContent>

        <TabsContent value="comments" className="mt-0">
          <CommentsAdminTab />
        </TabsContent>

        <TabsContent value="reports" className="mt-0">
          <ReportsAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForumManagement;
