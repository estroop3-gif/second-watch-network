import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface FilmmakerProfile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  filmmaker_profiles: {
    full_name: string | null;
    department: string | null;
    experience_level: string | null;
    location: string | null;
  }[];
}

const fetchFilmmakerProfiles = async (): Promise<FilmmakerProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      avatar_url,
      filmmaker_profiles!inner(
        full_name,
        department,
        experience_level,
        location
      )
    `)
    .eq('has_completed_filmmaker_onboarding', true);

  if (error) {
    console.error("Error fetching filmmaker profiles:", error);
    throw new Error(error.message);
  }
  
  // The !inner join ensures that we only get profiles with a filmmaker_profile.
  // The type system might still think filmmaker_profiles can be null, so we filter just in case.
  return data.filter(p => p.filmmaker_profiles) as FilmmakerProfile[];
};

const FilmmakerProfileManagement = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const queryClient = useQueryClient();
  const { data: profiles, isLoading, error } = useQuery<FilmmakerProfile[]>({
    queryKey: ['admin-filmmaker-profiles'],
    queryFn: fetchFilmmakerProfiles,
  });

  const handleRevokeProfile = async (userId: string) => {
    // This is a two-step process. Ideally, this would be a single RPC call for atomicity.
    // Step 1: Delete the filmmaker-specific profile data.
    const { error: deleteError } = await supabase
      .from('filmmaker_profiles')
      .delete()
      .eq('user_id', userId);

    if (deleteError) {
      toast.error(`Failed to remove filmmaker profile: ${deleteError.message}`);
      return;
    }

    // Step 2: Update the main profile to mark onboarding as incomplete.
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ has_completed_filmmaker_onboarding: false })
      .eq('id', userId);
    
    if (updateError) {
      toast.error(`Profile data removed, but failed to update onboarding status: ${updateError.message}`);
    } else {
      toast.success("Filmmaker profile has been revoked successfully.");
    }

    queryClient.invalidateQueries({ queryKey: ['admin-filmmaker-profiles'] });
  };

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    if (!searchTerm) return profiles;

    const lowercasedFilter = searchTerm.toLowerCase();
    return profiles.filter(profile => {
      const fp = profile.filmmaker_profiles[0];
      return (
        profile.username?.toLowerCase().includes(lowercasedFilter) ||
        fp?.full_name?.toLowerCase().includes(lowercasedFilter) ||
        fp?.department?.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [profiles, searchTerm]);

  if (error) {
    toast.error(`Failed to fetch filmmaker profiles: ${error.message}`);
  }

  return (
    <div>
      <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-8 -rotate-1">
        Filmmaker <span className="font-spray text-accent-yellow">Profiles</span>
      </h1>
      
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-gray" />
        <Input
          placeholder="Search by name, username, or department..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="border-2 border-muted-gray p-2 bg-charcoal-black/50">
        <Table>
          <TableHeader>
            <TableRow className="border-b-muted-gray hover:bg-charcoal-black/20">
              <TableHead>Filmmaker</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Experience</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center h-48">Loading profiles...</TableCell></TableRow>
            ) : error ? (
              <TableRow><TableCell colSpan={5} className="text-center h-48 text-primary-red">Error: {error.message}</TableCell></TableRow>
            ) : filteredProfiles.map((profile) => {
              const fp = profile.filmmaker_profiles[0];
              return (
                <TableRow key={profile.id} className="border-b-muted-gray hover:bg-charcoal-black/20">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={profile.avatar_url ?? undefined} />
                        <AvatarFallback>{fp?.full_name?.charAt(0) ?? '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold">{fp?.full_name}</p>
                        <p className="text-sm text-muted-gray">@{profile.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{fp?.department || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{fp?.experience_level?.replace(/_/g, ' ') || 'N/A'}</TableCell>
                  <TableCell>{fp?.location || 'N/A'}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm" className="mr-2">
                      <Link to={`/profile/${profile.username}`} target="_blank" rel="noopener noreferrer">
                        View <ExternalLink className="ml-2 h-4 w-4" />
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
                            This will revoke this user's filmmaker status and remove their public filmmaker profile. This does not delete their user account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevokeProfile(profile.id)} className="bg-primary-red hover:bg-red-700">
                            Revoke Profile
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

export default FilmmakerProfileManagement;