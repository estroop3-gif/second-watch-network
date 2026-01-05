import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, User, Mail, Link as LinkIcon, MapPin, Briefcase, Star, Film, Building, UserPlus, MessageSquare, Shield, Clapperboard } from 'lucide-react';
import { FilmmakerProfileData } from '@/types';
import ProfileProjects from '@/components/profile/ProfileProjects';
import ProfileStatus from '@/components/profile/ProfileStatus';
import ProfileStatusUpdates from '@/components/profile/ProfileStatusUpdates';
import ProfileAvailability from '@/components/profile/ProfileAvailability';
import ProfileHeaderConnect from '@/components/profile/ProfileHeaderConnect';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface ActiveProject {
  id: string;
  title: string;
  status: string;
  role: string;
}

const FilmmakerProfile = () => {
  const { username } = useParams<{ username: string }>();
  const { user, profile: authProfile } = useAuth();
  const queryClient = useQueryClient();

  // Check if this is the current user's own profile
  const isOwnProfile = authProfile?.username === username || user?.email?.split('@')[0] === username;

  const { data: profile, isLoading: loading, error: queryError } = useQuery<FilmmakerProfileData | null>({
    queryKey: ['filmmaker-profile-by-username', username],
    queryFn: async () => {
      if (!username) return null;
      try {
        const data = await api.getFilmmakerProfileByUsername(username);
        return data;
      } catch {
        return null;
      }
    },
    enabled: !!username,
  });

  // Fetch active projects
  const { data: activeProjects } = useQuery<ActiveProject[]>({
    queryKey: ['active-projects', profile?.user_id],
    queryFn: async () => {
      if (!profile?.user_id) return [];
      try {
        return await api.getActiveProjects(profile.user_id);
      } catch {
        return [];
      }
    },
    enabled: !!profile?.user_id,
  });

  const error = queryError ? (queryError as Error).message : null;
  const profileNotFound = !loading && !error && !profile;

  // Polling fallback for profile updates (replacing realtime)
  useEffect(() => {
    if (!profile?.user_id) return;

    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['filmmaker-profile-by-username', username] });
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [profile?.user_id, username, queryClient]);

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

  // Handle profile not found - show friendly message with option to create profile
  if (profileNotFound || !profile) {
    return (
      <div className="container mx-auto px-4 max-w-lg py-12 text-center">
        <div className="mb-6">
          <User className="h-16 w-16 mx-auto text-muted-gray" />
        </div>
        <h2 className="text-2xl font-heading mb-2">Filmmaker Profile Not Found</h2>
        {isOwnProfile ? (
          <>
            <p className="text-muted-gray mb-6">
              You haven't set up your filmmaker profile yet. Complete your profile to showcase your work and connect with the community.
            </p>
            <Button asChild>
              <Link to="/filmmaker-onboarding">
                <UserPlus className="mr-2 h-4 w-4" />
                Complete Your Profile
              </Link>
            </Button>
          </>
        ) : (
          <p className="text-muted-gray">
            This user hasn't set up a public filmmaker profile yet.
          </p>
        )}
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
              {profile.contact_method && (
                <p className="flex items-center gap-2"><MessageSquare className="h-4 w-4 text-muted-gray" /> Prefers: {profile.contact_method}</p>
              )}
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
              {/* Order Membership */}
              {(profile as any).order_info && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20 border-l-4 border-l-accent-yellow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-heading flex items-center gap-2">
                      <Shield className="h-5 w-5 text-accent-yellow" />
                      Order Membership
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-bone-white">Member of The Second Watch Order</p>
                    {(profile as any).order_info.lodge && (
                      <p className="text-muted-gray text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {(profile as any).order_info.lodge.name} Lodge
                        {(profile as any).order_info.lodge.city && ` - ${(profile as any).order_info.lodge.city}, ${(profile as any).order_info.lodge.state}`}
                      </p>
                    )}
                    {(profile as any).order_info.officer_title && (
                      <Badge variant="outline" className="border-accent-yellow text-accent-yellow">
                        {(profile as any).order_info.officer_title}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Currently Working On */}
              {activeProjects && activeProjects.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader>
                    <CardTitle className="text-lg font-heading flex items-center gap-2">
                      <Clapperboard className="h-5 w-5 text-accent-yellow" />
                      Currently Working On
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {activeProjects.map((project) => (
                        <li key={project.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-bone-white">{project.title}</p>
                            <p className="text-sm text-muted-gray">{project.role}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              project.status === 'production'
                                ? 'border-green-500/50 text-green-400'
                                : project.status === 'pre-production'
                                ? 'border-blue-500/50 text-blue-400'
                                : 'border-purple-500/50 text-purple-400'
                            }
                          >
                            {project.status.replace('-', ' ')}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

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

              {/* Featured Credits */}
              {profile.credits?.filter((c: any) => c.is_featured).length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20 border-l-4 border-l-primary-red">
                  <CardHeader>
                    <CardTitle className="text-lg font-heading flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary-red fill-primary-red" />
                      Featured Work
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {profile.credits.filter((c: any) => c.is_featured).map((credit: any) => (
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

              {/* All Credits */}
              {profile.credits?.length > 0 && (
                <Card className="bg-charcoal-black/50 border-muted-gray/20">
                  <CardHeader><CardTitle className="text-lg font-heading">Credits</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-4">
                      {profile.credits.map((credit: any) => (
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