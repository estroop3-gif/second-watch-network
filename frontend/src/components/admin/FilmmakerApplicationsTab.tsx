import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { FilmmakerApplication } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ViewApplicationModal from './ViewApplicationModal';
import { Skeleton } from '@/components/ui/skeleton';

type ApplicationWithProfile = FilmmakerApplication & { profiles: { roles: string[] } | null };

const FilmmakerApplicationsTab = () => {
  const queryClient = useQueryClient();
  const [selectedApp, setSelectedApp] = useState<FilmmakerApplication | null>(null);

  const { data: applications, isLoading, error } = useQuery<ApplicationWithProfile[], Error>({
    queryKey: ['filmmakerApplications'],
    queryFn: async () => {
      const data = await api.listFilmmakerApplications();
      return data as ApplicationWithProfile[];
    },
  });

  const updateApplication = async ({ id, status }: { id: string; status: 'approved' | 'rejected' }) => {
    if (status === 'approved') {
      await api.approveFilmmakerApplication(id);
    } else {
      await api.rejectFilmmakerApplication(id);
    }
  };

  const mutation = useMutation({
    mutationFn: updateApplication,
    onSuccess: (_, variables) => {
      toast.success(`Application ${variables.status}.`);
      queryClient.invalidateQueries({ queryKey: ['filmmakerApplications'] });
      queryClient.invalidateQueries({ queryKey: ['filmmaker_profiles'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  if (isLoading) {
    return (
      <div className="mt-4">
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full mb-2" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) return <div className="text-red-500 mt-4">Error loading applications: {error.message}</div>;

  return (
    <>
      <div className="mt-4 border border-muted-gray rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications?.map((app) => (
              <TableRow key={app.id}>
                <TableCell>{app.full_name}</TableCell>
                <TableCell>{app.email}</TableCell>
                <TableCell>{format(new Date(app.created_at), 'MMM d, yyyy')}</TableCell>
                <TableCell>
                  <Badge variant={
                    app.status === 'approved' ? 'default' :
                    app.status === 'rejected' ? 'destructive' : 'secondary'
                  } className="capitalize">{app.status}</Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedApp(app)}>View</Button>
                  {app.status === 'pending' && (
                    <>
                      <Button variant="default" size="sm" onClick={() => mutation.mutate({ id: app.id, status: 'approved' })}>Approve</Button>
                      <Button variant="destructive" size="sm" onClick={() => mutation.mutate({ id: app.id, status: 'rejected' })}>Reject</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {selectedApp && (
        <ViewApplicationModal
          application={selectedApp}
          isOpen={!!selectedApp}
          onClose={() => setSelectedApp(null)}
        />
      )}
    </>
  );
};

export default FilmmakerApplicationsTab;