import React from 'react';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MessageSquare, Trash2, ListTree, Reply, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

// Types
interface ForumThread {
  id: string;
  title: string;
  created_at: string;
  username: string | null;
  full_name: string | null;
  category_name: string | null;
  replies_count: number;
}

interface ForumReply {
  id: string;
  body: string;
  created_at: string;
  username: string | null;
  full_name: string | null;
  thread_id: string;
  thread_title: string;
}

interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

// Components
const ThreadsTable = () => {
  const queryClient = useQueryClient();
  const { data: threads, isLoading, error } = useQuery({
    queryKey: ['admin-forum-threads'],
    queryFn: () => api.listForumThreadsAdmin(),
  });

  const handleDeleteThread = async (threadId: string) => {
    try {
      await api.deleteForumThreadAdmin(threadId);
      toast.success("Thread and its replies have been deleted.");
      queryClient.invalidateQueries({ queryKey: ['admin-forum-threads'] });
    } catch (error: any) {
      toast.error(`Failed to delete thread: ${error.message}`);
    }
  };

  if (error) toast.error(`Failed to fetch threads: ${(error as Error).message}`);

  return (
    <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Replies</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={6} className="text-center h-48">Loading threads...</TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={6} className="text-center h-48 text-primary-red">Error: {(error as Error).message}</TableCell></TableRow>
          ) : threads?.map((thread: ForumThread) => (
            <TableRow key={thread.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableCell className="font-medium max-w-xs truncate">
                <Link to={`/the-backlot/threads/${thread.id}`} className="hover:underline" title={thread.title}>
                  {thread.title}
                </Link>
              </TableCell>
              <TableCell>{thread.full_name || thread.username || 'N/A'}</TableCell>
              <TableCell>{thread.category_name || 'N/A'}</TableCell>
              <TableCell>{thread.replies_count ?? 0}</TableCell>
              <TableCell>{format(new Date(thread.created_at), 'MMM dd, yyyy')}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this thread and all of its replies. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteThread(thread.id)} className="bg-primary-red hover:bg-red-700">Delete Thread</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const RepliesTable = () => {
  const queryClient = useQueryClient();
  const { data: replies, isLoading, error } = useQuery({
    queryKey: ['admin-forum-replies'],
    queryFn: () => api.listForumRepliesAdmin(),
  });

  const handleDeleteReply = async (replyId: string) => {
    try {
      await api.deleteForumReplyAdmin(replyId);
      toast.success("The reply has been deleted.");
      queryClient.invalidateQueries({ queryKey: ['admin-forum-replies'] });
      queryClient.invalidateQueries({ queryKey: ['admin-forum-threads'] });
    } catch (error: any) {
      toast.error(`Failed to delete reply: ${error.message}`);
    }
  };

  if (error) toast.error(`Failed to fetch replies: ${(error as Error).message}`);

  return (
    <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
            <TableHead>Reply</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>In Thread</TableHead>
            <TableHead>Posted At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center h-48">Loading replies...</TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={5} className="text-center h-48 text-primary-red">Error: {(error as Error).message}</TableCell></TableRow>
          ) : replies?.map((reply: ForumReply) => (
            <TableRow key={reply.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableCell className="font-medium max-w-sm truncate" title={reply.body}>{reply.body}</TableCell>
              <TableCell>{reply.full_name || reply.username || 'N/A'}</TableCell>
              <TableCell className="max-w-xs truncate">
                <Link to={`/the-backlot/threads/${reply.thread_id}`} className="hover:underline" title={reply.thread_title}>
                  {reply.thread_title || 'N/A'}
                </Link>
              </TableCell>
              <TableCell>{format(new Date(reply.created_at), 'MMM dd, yyyy, p')}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this reply. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteReply(reply.id)} className="bg-primary-red hover:bg-red-700">Delete Reply</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const categoryFormSchema = z.object({
  name: z.string().min(3, { message: "Category name must be at least 3 characters." }),
  description: z.string().max(200, { message: "Description must be 200 characters or less." }).optional(),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

const CategoryDialog = ({ category, children }: { category?: ForumCategory, children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: category?.name || "",
      description: category?.description || "",
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      form.reset({
        name: category?.name || "",
        description: category?.description || "",
      });
    }
  }, [isOpen, category, form]);

  const onSubmit = async (values: CategoryFormValues) => {
    const slug = slugify(values.name);
    try {
      if (category) {
        await api.updateForumCategoryAdmin(category.id, { ...values, slug });
      } else {
        await api.createForumCategoryAdmin({ ...values, slug });
      }
      toast.success(`Category ${category ? 'updated' : 'created'} successfully.`);
      queryClient.invalidateQueries({ queryKey: ['admin-forum-categories'] });
      setIsOpen(false);
    } catch (error: any) {
      toast.error(`Failed to save category: ${error.message}`);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit' : 'Create'} Category</DialogTitle>
          <DialogDescription>
            {category ? 'Update the details for this category.' : 'Create a new category for forum threads.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
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
                    <Textarea placeholder="A short description of the category." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Category'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const CategoriesTable = () => {
  const queryClient = useQueryClient();
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['admin-forum-categories'],
    queryFn: () => api.listForumCategoriesAdmin(),
  });

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await api.deleteForumCategoryAdmin(categoryId);
      toast.success("Category has been deleted.");
      queryClient.invalidateQueries({ queryKey: ['admin-forum-categories'] });
    } catch (error: any) {
      toast.error(`Failed to delete category: ${error.message}`, {
        description: "You may need to re-assign or delete threads in this category first."
      });
    }
  };

  if (error) toast.error(`Failed to fetch categories: ${(error as Error).message}`);

  return (
    <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
      <div className="flex justify-end mb-4">
        <CategoryDialog>
          <Button>Create Category</Button>
        </CategoryDialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={3} className="text-center h-48">Loading categories...</TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={3} className="text-center h-48 text-primary-red">Error: {(error as Error).message}</TableCell></TableRow>
          ) : categories?.map((category: ForumCategory) => (
            <TableRow key={category.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell className="max-w-md truncate">{category.description}</TableCell>
              <TableCell className="text-right">
                <CategoryDialog category={category}>
                  <Button type="button" variant="ghost" size="icon" className="text-accent-yellow hover:text-yellow-400 mr-2">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </CategoryDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this category. This action cannot be undone. Make sure no threads are using this category.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCategory(category.id)} className="bg-primary-red hover:bg-red-700">Delete Category</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

const ForumManagement = () => {
  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Forum <span className="font-spray text-accent-yellow">Tools</span>
      </h1>

      <Tabs defaultValue="threads" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="threads"><MessageSquare className="mr-2 h-4 w-4" />Threads</TabsTrigger>
          <TabsTrigger value="replies"><Reply className="mr-2 h-4 w-4" />Replies</TabsTrigger>
          <TabsTrigger value="categories"><ListTree className="mr-2 h-4 w-4" />Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="threads" className="mt-6">
          <Card className="bg-transparent border-0 p-0">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Manage Threads</CardTitle>
              <CardDescription>Oversee and moderate all forum threads.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ThreadsTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="replies" className="mt-6">
          <Card className="bg-transparent border-0 p-0">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Manage Replies</CardTitle>
              <CardDescription>Oversee and moderate all individual replies.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <RepliesTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <Card className="bg-transparent border-0 p-0">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Manage Categories</CardTitle>
              <CardDescription>Create, edit, and delete forum categories.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <CategoriesTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ForumManagement;
