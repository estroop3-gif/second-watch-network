/**
 * SlatePage - "The Slate" public production detail page
 * Shows production info, cast & crew with profile links
 * Accessible via /slate/:slug (no auth required)
 */
import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Film,
  Calendar,
  Building2,
  Users,
  ChevronLeft,
  ExternalLink,
  Clapperboard,
} from 'lucide-react';
import { useProductionBySlug } from '@/hooks/useProduction';

const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  documentary: 'Documentary',
  feature_film: 'Feature Film',
  short_film: 'Short Film',
  series_episodic: 'Series/Episodic (TV)',
  limited_series: 'Limited Series',
  commercial: 'Commercial',
  music_video: 'Music Video',
  corporate_industrial: 'Corporate/Industrial',
  wedding_event: 'Wedding/Event',
  web_content: 'Web Content/Streaming',
  live_event: 'Live Event',
  news_eng: 'News/ENG',
};

const STATUS_LABELS: Record<string, string> = {
  released: 'Released',
  in_production: 'In Production',
  post_production: 'Post-Production',
  pre_production: 'Pre-Production',
  announced: 'Announced',
};

const STATUS_COLORS: Record<string, string> = {
  released: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_production: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  post_production: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pre_production: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  announced: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
};

const SlatePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: production, isLoading, error } = useProductionBySlug(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black">
        <div className="container mx-auto px-4 max-w-4xl py-8">
          <Skeleton className="h-64 w-full rounded-lg mb-8" />
          <Skeleton className="h-10 w-3/4 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !production) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Clapperboard className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h2 className="text-2xl font-heading text-bone-white mb-4">Production Not Found</h2>
          <p className="text-muted-gray mb-6">
            This production doesn't exist or has been removed.
          </p>
          <Link to="/">
            <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const castCrew = production.cast_crew || [];
  const genres = production.genre || [];

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto px-4 max-w-4xl py-8">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center text-muted-gray hover:text-bone-white transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Link>

        {/* Hero Section */}
        <div className="flex flex-col md:flex-row gap-8 mb-10">
          {/* Poster / Placeholder */}
          <div className="w-full md:w-64 flex-shrink-0">
            {production.poster_url ? (
              <img
                src={production.poster_url}
                alt={production.name}
                className="w-full rounded-lg shadow-lg object-cover aspect-[2/3]"
              />
            ) : (
              <div className="w-full rounded-lg bg-muted-gray/10 border border-muted-gray/20 flex items-center justify-center aspect-[2/3]">
                <Film className="w-16 h-16 text-muted-gray/30" />
              </div>
            )}
          </div>

          {/* Production Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 mb-3 flex-wrap">
              {production.status && (
                <Badge
                  variant="outline"
                  className={STATUS_COLORS[production.status] || 'bg-muted-gray/20 text-muted-gray'}
                >
                  {STATUS_LABELS[production.status] || production.status}
                </Badge>
              )}
              {production.production_type && (
                <Badge variant="outline" className="bg-charcoal-black/50 text-muted-gray border-muted-gray/30">
                  {PRODUCTION_TYPE_LABELS[production.production_type] || production.production_type}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-heading text-bone-white mb-2">
              {production.name}
            </h1>

            {(production.year || production.company) && (
              <div className="flex items-center gap-4 text-muted-gray mb-4">
                {production.year && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {production.year}
                  </span>
                )}
                {production.company && (
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-4 h-4" />
                    {production.company}
                  </span>
                )}
              </div>
            )}

            {production.logline && (
              <p className="text-bone-white/80 text-lg italic mb-4">
                "{production.logline}"
              </p>
            )}

            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {genres.map((genre: string) => (
                  <Badge
                    key={genre}
                    variant="outline"
                    className="bg-primary-red/10 text-primary-red border-primary-red/30 text-xs"
                  >
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {production.description && (
              <p className="text-muted-gray leading-relaxed">
                {production.description}
              </p>
            )}

            {/* Backlot project link */}
            {production.backlot_slug && (
              <div className="mt-4">
                <Link to={`/projects/${production.backlot_slug}`}>
                  <Button variant="outline" size="sm" className="text-accent-yellow border-accent-yellow/30 hover:bg-accent-yellow/10">
                    <Clapperboard className="w-4 h-4 mr-2" />
                    View Backlot Project
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Cast & Crew Section */}
        {castCrew.length > 0 && (
          <div className="border-t border-muted-gray/20 pt-8">
            <h2 className="text-2xl font-heading text-bone-white mb-6 flex items-center gap-2">
              <Users className="w-6 h-6" />
              Cast & Crew
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {castCrew.map((person: any) => (
                <CastCrewCard key={person.id} person={person} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state when no credits */}
        {castCrew.length === 0 && (
          <div className="border-t border-muted-gray/20 pt-8">
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
              <p className="text-muted-gray">No cast or crew listed yet.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const CastCrewCard: React.FC<{ person: any }> = ({ person }) => {
  const displayName = person.display_name || 'Unknown';
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const sourceLabel =
    person.source === 'backlot_cast'
      ? 'Cast'
      : person.source === 'backlot_crew'
        ? 'Crew'
        : null;

  const content = (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-charcoal-black/50 border border-muted-gray/20 hover:border-muted-gray/40 transition-colors">
      <Avatar className="h-10 w-10 flex-shrink-0">
        <AvatarImage src={person.avatar_url} />
        <AvatarFallback className="bg-muted-gray/20 text-bone-white text-sm">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-bone-white truncate text-sm">
          {displayName}
        </p>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-gray truncate">
            {person.position || 'Credit'}
          </p>
          {sourceLabel && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-muted-gray/30 text-muted-gray">
              {sourceLabel}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );

  // Link to profile if username is available
  if (person.username) {
    return (
      <Link to={`/profile/${person.username}`} className="block">
        {content}
      </Link>
    );
  }

  return content;
};

export default SlatePage;
