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
import { Clapperboard, ListTree, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

// Types
interface Production {
  id: string;
  title: string;
  slug: string;
  created_at: string;
  profiles: {
    username: string | null;
    full_name: string | null;
  } | null;
}

interface Credit {
  id: string;
  position: string;
  production_date: string;
  profiles: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  productions: {
    title: string;
    slug: string;
  } | null;
}

// Components
const ProductionsTable = () => {
  const queryClient = useQueryClient();
  const { data: productions, isLoading, error } = useQuery({
    queryKey: ['admin-productions'],
    queryFn: async () => {
      const data = await api.listAllProductionsAdmin();
      return data as Production[];
    },
  });

  if (error) toast.error(`Failed to fetch productions: ${(error as Error).message}`);

  const handleDeleteProduction = async (productionId: string) => {
    try {
      await api.deleteProductionAdmin(productionId);
      toast.success("Production deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ['admin-productions'] });
    } catch (error: any) {
      toast.error(`Failed to delete production: ${error.message}`, {
        description: "You may need to delete associated credits first."
      });
    }
  };

  return (
    <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
            <TableHead>Title</TableHead>
            <TableHead>Created By</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={4} className="text-center h-48">Loading productions...</TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={4} className="text-center h-48 text-primary-red">Error: {error.message}</TableCell></TableRow>
          ) : productions?.map((prod) => (
            <TableRow key={prod.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableCell className="font-medium">{prod.title}</TableCell>
              <TableCell>{prod.profiles?.full_name || prod.profiles?.username || 'N/A'}</TableCell>
              <TableCell>{format(new Date(prod.created_at), 'MMM dd, yyyy')}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this production. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteProduction(prod.id)} className="bg-primary-red hover:bg-red-700">Delete Production</AlertDialogAction>
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

const CreditsTable = () => {
  const queryClient = useQueryClient();
  const { data: credits, isLoading, error } = useQuery({
    queryKey: ['admin-credits'],
    queryFn: async () => {
      const data = await api.listAllCreditsAdmin();
      return data as Credit[];
    },
  });

  if (error) toast.error(`Failed to fetch credits: ${(error as Error).message}`);

  const handleDeleteCredit = async (creditId: string) => {
    try {
      await api.deleteCreditAdmin(creditId);
      toast.success("Credit deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ['admin-credits'] });
    } catch (error: any) {
      toast.error(`Failed to delete credit: ${error.message}`);
    }
  };

  return (
    <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
      <Table>
        <TableHeader>
          <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
            <TableHead>Filmmaker</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Production</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center h-48">Loading credits...</TableCell></TableRow>
          ) : error ? (
            <TableRow><TableCell colSpan={5} className="text-center h-48 text-primary-red">Error: {error.message}</TableCell></TableRow>
          ) : credits?.map((credit) => (
            <TableRow key={credit.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableCell>
                <Link to={`/profile/${credit.profiles?.username}`} className="flex items-center gap-3 hover:underline">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={credit.profiles?.avatar_url ?? undefined} />
                    <AvatarFallback>{credit.profiles?.full_name?.charAt(0) ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span>{credit.profiles?.full_name || credit.profiles?.username}</span>
                </Link>
              </TableCell>
              <TableCell>{credit.position}</TableCell>
              <TableCell>{credit.productions?.title || 'N/A'}</TableCell>
              <TableCell>{credit.production_date ? format(new Date(credit.production_date), 'yyyy') : 'N/A'}</TableCell>
              <TableCell className="text-right">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this credit. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteCredit(credit.id)} className="bg-primary-red hover:bg-red-700">Delete Credit</AlertDialogAction>
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

const ContentManagement = () => {
  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Content & <span className="font-spray text-accent-yellow">Credits</span>
      </h1>
      
      <Tabs defaultValue="productions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="productions">
            <Clapperboard className="mr-2 h-4 w-4" />
            Productions
          </TabsTrigger>
          <TabsTrigger value="credits">
            <ListTree className="mr-2 h-4 w-4" />
            Credits
          </TabsTrigger>
        </TabsList>
        <TabsContent value="productions" className="mt-6">
          <Card className="bg-transparent border-0 p-0">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Manage Productions</CardTitle>
              <CardDescription>View and manage all film productions in the database.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ProductionsTable />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="credits" className="mt-6">
          <Card className="bg-transparent border-0 p-0">
            <CardHeader className="p-0 mb-4">
              <CardTitle>Manage Credits</CardTitle>
              <CardDescription>View, edit, or remove individual credits associated with productions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <CreditsTable />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ContentManagement;