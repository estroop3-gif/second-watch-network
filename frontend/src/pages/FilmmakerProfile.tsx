import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User, Mail, Link as LinkIcon, MapPin, Briefcase, Star, Film, Building } from 'lucide-react';
import { FilmmakerProfileData } from '@/types';
import ProfileProjects from '@/components/profile/ProfileProjects';
import ProfileStatus from '@/components/profile/ProfileStatus';
import ProfileStatusUpdates from '@/components/profile/ProfileStatusUpdates';
import ProfileAvailability from '@/components/profile/ProfileAvailability';
import ProfileHeaderConnect from '@/components/profile/ProfileHeaderConnect';

const FilmmakerProfile = () => {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<FilmmakerProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke('get-filmmaker-profile', {
          body: { username: username },
        });

        if (functionError) throw new Error(functionError.message);
        if (data.error) throw new Error(data.error);
        if (!data.profile) throw new Error("Filmmaker profile not found.");

        setProfile(data.profile);
      } catch (e: any) {
        setError(e.message || "An unexpected error occurred.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [username]);

  useEffect(() => {
    if (!profile?.user_id) return;

    const channel = supabase
      .channel(`profile-and-credits:${profile.user_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.user_id}` }, () => {
        // refetch profile from edge function
        (async () => {
          const { data } = await supabase.functions.invoke('get-filmmaker-profile', { body: { username } });
          if (data?.profile) setProfile(data.profile);
        })();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'filmmaker_profiles', filter: `user_id=eq.${profile.user_id}` }, () => {
        (async () => {
          const { data } = await supabase.functions.invoke('get-filmmaker-profile', { body: { username } });
          if (data?.profile) setProfile(data.profile);
        })();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credits', filter: `user_id=eq.${profile.user_id}` }, () => {
        (async () => {
          const { data } = await supabase.functions.invoke('get-filmmaker-profile', { body: { username } });
          if (data?.profile) setProfile(data.profile);
        })();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.user_id, username]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-accent-yellow" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-12 text-center">
        <h2 className="text-2xl font-heading text-primary-red">Error</h2>
        <p className="text-muted-gray">{error}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 max-w-4xl py-12 text-center">
        <h2 className="text-2xl font-heading">Profile Not Found</h2>
        <p className="text-muted-gray">We couldn't find a filmmaker profile for this user.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-5xl py-12">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Sidebar */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Avatar className="w-32 h-32 mb-4 border-4 border-muted-gray">
                <AvatarImage src={profile.profile_image_url || undefined} />
                <AvatarFallback className="bg-muted-gray"><User className="w-16 h-16 text-bone-white" /></AvatarFallback>
              </Avatar>
              <h1 className="text-2xl font-bold font-heading">{profile.full_name}</h1>
              {profile.display_name && <p className="text-lg text-accent-yellow -mt-1">{profile.display_name}</p>}
              <p className="text-muted-gray">@{profile.profile.username}</p>
              {profile.accepting_work && (
                <Badge variant="secondary" className="mt-2 bg-green-500/20 text-green-300 border-green-500/50">
                  Accepting Work
                </Badge>
              )}
              <div className="w-full mt-4">
                <ProfileHeaderConnect userId={profile.user_id} />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader><CardTitle className="text-lg font-heading">Contact & Links</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {profile.show_email && profile.email && (
                <a href={`mailto:${profile.email}`} className="w-full">
                  <Button variant="outline" className="w-full"><Mail className="mr-2 h-4 w-4" /> Contact via Email</Button>
                </a>
              )}
              {profile.portfolio_website && (
                <a href={profile.portfolio_website} target="_blank" rel="noopener noreferrer" className="w-full">
                  <Button variant="outline" className="w-full"><LinkIcon className="mr-2 h-4 w-4" /> Portfolio</Button>
                </a>
              )}
            </CardContent>
          </Card>

          <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader><CardTitle className="text-lg font-heading">Details</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {profile.location && (
                <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-gray" /> {profile.location}</p>
              )}
              <p className="flex items-center gap-2"><Briefcase className="h-4 w-4 text-muted-gray" /> {profile.department}</p>
              <p className="flex items-center gap-2"><Star className="h-4 w-4 text-muted-gray" /> {profile.experience_level}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="md:col-span-2">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="updates">Updates</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="availability">Availability</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6 space-y-8">
              {profile.bio && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">About Me</CardTitle></CardHeader>
                  <CardContent className="prose prose-invert prose-sm max-w-none"><p>{profile.bio}</p></CardContent>
                </Card>
              )}
              {profile.skills?.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Skills</CardTitle></CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {profile.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                  </CardContent>
                </Card>
              )}
              {profile.reel_links?.length > 0 && (
                 <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Reels</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {profile.reel_links.map((link, index) => (
                      <a key={index} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-accent-yellow hover:underline text-sm"><Film className="h-4 w-4" /> {link}</a>
                    ))}
                  </CardContent>
                </Card>
              )}
              {profile.credits?.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Credits</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {profile.credits.map(credit => (
                        <li key={credit.id}>
                          <p className="font-semibold">{credit.position}</p>
                          <p className="text-sm text-muted-gray flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            {credit.productions.title}
                            {credit.production_date && ` (${new Date(credit.production_date).getFullYear()})`}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="updates" className="mt-6">
              <ProfileStatusUpdates profile={profile} />
            </TabsContent>
            <TabsContent value="projects" className="mt-6">
              <ProfileProjects credits={profile.credits || []} />
            </TabsContent>
            <TabsContent value="availability" className="mt-6">
              <div className="space-y-8">
                <ProfileStatus profile={profile} />
                <ProfileAvailability user_id={profile.user_id} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default FilmmakerProfile;