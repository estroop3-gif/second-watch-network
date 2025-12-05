import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ExternalLink, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface AvailabilityRecord {
  id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
  profiles: {
    username: string | null;
    avatar_url: string | null;
    filmmaker_profiles: {
      full_name: string | null;
      department: string | null;
    }[] | null;
  } | null;
}

const fetchAvailability = async (): Promise<AvailabilityRecord[]> => {
  const { data, error } = await supabase
    .from('availability')
    .select(`
      id,
      start_date,
      end_date,
      notes,
      created_at,
      profiles (
        username,
        avatar_url,
        filmmaker_profiles (
          full_name,
          department
        )
      )
    `);

  if (error) {
    console.error("Error fetching availability:", error);
    throw new Error(error.message);
  }
  return data as AvailabilityRecord[];
};

const AvailabilityManagement = () => {
  const [sortBy, setSortBy] = useState<'start_date' | 'created_at'>('start_date');
  const queryClient = useQueryClient();
  const { data: availability, isLoading, error } = useQuery<AvailabilityRecord[]>({
    queryKey: ['admin-availability'],
    queryFn: fetchAvailability,
  });

  const handleDeleteAvailability = async (recordId: string) => {
    const { error } = await supabase.from('availability').delete().eq('id', recordId);

    if (error) {
      toast.error(`Failed to delete availability record: ${error.message}`);
    } else {
      toast.success("Availability record deleted.");
      queryClient.invalidateQueries({ queryKey: ['admin-availability'] });
    }
  };

  const sortedAvailability = useMemo(() => {
    if (!availability) return [];
    return [...availability].sort((a, b) => {
      const dateA = new Date(a[sortBy]).getTime();
      const dateB = new Date(b[sortBy]).getTime();
      if (sortBy === 'created_at') {
        return dateB - dateA; // Most recent first
      }
      return dateA - dateB; // Soonest first
    });
  }, [availability, sortBy]);

  if (error) {
    toast.error(`Failed to fetch availability: ${error.message}`);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter -rotate-1">
          Filmmaker <span className="font-spray text-accent-yellow">Availability</span>
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-muted-gray">Sort by:</span>
          <Select value={sortBy} onValueChange={(value: 'start_date' | 'created_at') => setSortBy(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start_date">Start Date</SelectItem>
              <SelectItem value="created_at">Recently Added</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableHead>Filmmaker</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Available From</TableHead>
              <TableHead>Available To</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center h-48">Loading availability...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={6} className="text-center h-48 text-primary-red">Error: {error.message}</TableCell></TableRow>
            ) : sortedAvailability.map((record) => {
              const profile = record.profiles;
              const filmmakerProfile = profile?.filmmaker_profiles?.[0];
              return (
                <TableRow key={record.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={profile?.avatar_url ?? undefined} />
                        <AvatarFallback>{filmmakerProfile?.full_name?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold">{filmmakerProfile?.full_name}</p>
                        <p className="text-sm text-muted-gray">@{profile?.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{filmmakerProfile?.department || 'N/A'}</TableCell>
                  <TableCell>{format(new Date(record.start_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell>{format(new Date(record.end_date), 'MMM dd, yyyy')}</TableCell>
                  <TableCell className="max-w-xs truncate">{record.notes || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="icon" className="mr-2">
                      <Link to={`/profile/${profile?.username}`} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="text-primary-red hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this availability record. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteAvailability(record.id)} className="bg-primary-red hover:bg-red-700">
                            Delete Record
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default AvailabilityManagement;