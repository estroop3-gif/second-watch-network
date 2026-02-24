/**
 * SlatePersonPage - IMDB-style person/name page
 * Shows a person's profile, known-for poster cards, grouped filmography, and backlot credits
 * Accessible via /slate/person/:username (no auth required)
 */
import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Film,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  ExternalLink,
} from 'lucide-react';
import { useFilmography } from '@/hooks/useProduction';

const PRODUCTION_TYPE_LABELS: Record<string, string> = {
  documentary: 'Documentary',
  feature_film: 'Feature Film',
  short_film: 'Short Film',
  series_episodic: 'Series/Episodic',
  limited_series: 'Limited Series',
  commercial: 'Commercial',
  music_video: 'Music Video',
  corporate_industrial: 'Corporate',
  wedding_event: 'Wedding/Event',
  web_content: 'Web Content',
  live_event: 'Live Event',
  news_eng: 'News/ENG',
};

// ─── Loading Skeleton ────────────────────────────────────────────────────────

const LoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-charcoal-black">
    <div className="container mx-auto px-4 max-w-5xl py-8">
      <Skeleton className="h-5 w-32 mb-8" />
      {/* Hero skeleton */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <Skeleton className="w-48 h-64 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      {/* Known For skeleton */}
      <Skeleton className="h-7 w-32 mb-4" />
      <div className="flex gap-4 mb-10">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="w-32 aspect-[2/3] rounded-lg flex-shrink-0" />
        ))}
      </div>
      {/* Stats skeleton */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      {/* Filmography skeleton */}
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

// ─── Error State ─────────────────────────────────────────────────────────────

const ErrorState: React.FC = () => (
  <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
    <div className="text-center">
      <User className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
      <h2 className="text-2xl font-heading text-bone-white mb-4">Person Not Found</h2>
      <p className="text-muted-gray mb-6">
        This person doesn't exist or has no public profile.
      </p>
      <Link to="/slate">
        <Button className="bg-accent-yellow text-charcoal-black hover:bg-bone-white">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to The Slate
        </Button>
      </Link>
    </div>
  </div>
);

// ─── Known For Poster Card ───────────────────────────────────────────────────

interface KnownForCredit {
  id: string;
  position: string;
  production_name: string;
  production_slug: string;
  year: number | null;
  poster_url: string | null;
}

const PosterCard: React.FC<{ credit: KnownForCredit }> = ({ credit }) => {
  const card = (
    <div className="w-32 flex-shrink-0 group cursor-pointer">
      <div className="w-32 aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-muted-gray/10 border border-muted-gray/20">
        {credit.poster_url ? (
          <img
            src={credit.poster_url}
            alt={credit.production_name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted-gray/10">
            <Film className="w-10 h-10 text-muted-gray/30" />
          </div>
        )}
      </div>
      <p className="text-sm text-bone-white font-semibold truncate group-hover:text-accent-yellow transition-colors">
        {credit.production_name}
      </p>
      {credit.year && (
        <p className="text-xs text-muted-gray">{credit.year}</p>
      )}
      <p className="text-xs text-muted-gray/70 truncate">{credit.position}</p>
    </div>
  );

  if (credit.production_slug) {
    return (
      <Link to={`/slate/${credit.production_slug}`} className="block flex-shrink-0">
        {card}
      </Link>
    );
  }
  return card;
};

// ─── Filmography Group (Collapsible) ─────────────────────────────────────────

interface FilmographyGroupProps {
  position: string;
  credits: any[];
  defaultOpen: boolean;
}

const FilmographyGroup: React.FC<FilmographyGroupProps> = ({ position, credits, defaultOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const sorted = useMemo(
    () => [...credits].sort((a, b) => (b.year || 0) - (a.year || 0)),
    [credits]
  );

  return (
    <div className="border border-muted-gray/20 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted-gray/5 hover:bg-muted-gray/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-bone-white font-heading text-lg">{position}</span>
          <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
            {credits.length}
          </Badge>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-gray" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        )}
      </button>

      {isOpen && (
        <div className="divide-y divide-muted-gray/10">
          {sorted.map((credit) => {
            const row = (
              <div
                key={credit.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-muted-gray/5 transition-colors group"
              >
                <span className="text-bone-white group-hover:text-accent-yellow transition-colors truncate flex-1 mr-4 flex items-center gap-2">
                  {credit.production_name}
                  {credit.source === 'backlot' && (
                    <Badge className="text-[10px] px-1.5 py-0 h-4 bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30 font-medium">
                      Backlot
                    </Badge>
                  )}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {credit.production_type && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-2 py-0 h-5 border-primary-red/30 text-primary-red hidden sm:inline-flex"
                    >
                      {PRODUCTION_TYPE_LABELS[credit.production_type] || credit.production_type}
                    </Badge>
                  )}
                  {credit.year && (
                    <span className="text-sm text-muted-gray tabular-nums">{credit.year}</span>
                  )}
                </div>
              </div>
            );

            if (credit.production_slug) {
              return (
                <Link
                  key={credit.id}
                  to={`/slate/${credit.production_slug}`}
                  className="block"
                >
                  {row}
                </Link>
              );
            }
            return <div key={credit.id}>{row}</div>;
          })}
        </div>
      )}
    </div>
  );
};

// ─── Main Page Component ─────────────────────────────────────────────────────

const SlatePersonPage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { data, isLoading, error } = useFilmography(username);
  const [bioExpanded, setBioExpanded] = useState(false);

  // Derived data (computed only when data is available)
  const derivedData = useMemo(() => {
    if (!data) return null;

    const { person, credits, backlot_credits } = data;
    const displayName = person.full_name || person.display_name || person.username;

    // Normalize backlot credits to match the production credit shape
    const normalizedBacklot = backlot_credits.map((c: any) => ({
      id: `backlot-${c.id}`,
      position: c.position || c.department || 'Crew',
      production_name: c.project_title,
      production_slug: c.project_slug ? `backlot/${c.project_slug}` : null,
      production_type: null,
      year: null,
      poster_url: null,
      source: 'backlot',
    }));

    // Tag production credits with source
    const taggedCredits = credits.map((c: any) => ({ ...c, source: 'production' }));

    // Merge all credits
    const allCredits = [...taggedCredits, ...normalizedBacklot];

    // Stats
    const totalCredits = allCredits.length;
    const uniqueProductions = new Set<string>();
    credits.forEach((c: any) => {
      if (c.production_slug) uniqueProductions.add(c.production_slug);
    });
    backlot_credits.forEach((c: any) => {
      if (c.project_slug) uniqueProductions.add(c.project_slug);
    });

    const years = allCredits
      .map((c: any) => c.year)
      .filter((y: any): y is number => typeof y === 'number' && y > 0);
    const earliestYear = years.length > 0 ? Math.min(...years) : null;

    // Known For: up to 6, prioritizing credits with poster_url, sorted by year desc
    const withPoster = [...taggedCredits]
      .filter((c: any) => c.poster_url)
      .sort((a: any, b: any) => (b.year || 0) - (a.year || 0));
    const withoutPoster = [...taggedCredits]
      .filter((c: any) => !c.poster_url)
      .sort((a: any, b: any) => (b.year || 0) - (a.year || 0));
    const knownFor = [...withPoster, ...withoutPoster].slice(0, 6);

    // Group ALL credits (production + backlot) by position
    const groupedByPosition: Record<string, any[]> = {};
    allCredits.forEach((c: any) => {
      const pos = c.position || 'Other';
      if (!groupedByPosition[pos]) groupedByPosition[pos] = [];
      groupedByPosition[pos].push(c);
    });
    // Sort groups by count (largest first)
    const positionGroups = Object.entries(groupedByPosition).sort(
      ([, a], [, b]) => b.length - a.length
    );

    return {
      person,
      displayName,
      totalCredits,
      uniqueProductionCount: uniqueProductions.size,
      earliestYear,
      knownFor,
      positionGroups,
    };
  }, [data]);

  if (isLoading) return <LoadingSkeleton />;
  if (error || !data || !derivedData) return <ErrorState />;

  const {
    person,
    displayName,
    totalCredits,
    uniqueProductionCount,
    earliestYear,
    knownFor,
    positionGroups,
  } = derivedData;

  return (
    <div className="min-h-screen bg-charcoal-black">
      <div className="container mx-auto px-4 max-w-5xl py-8">
        {/* Back link */}
        <Link
          to="/slate"
          className="inline-flex items-center text-muted-gray hover:text-bone-white transition-colors mb-8"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to The Slate
        </Link>

        {/* ── Hero Section ─────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start gap-8 mb-10">
          {/* Portrait photo — rectangular like IMDB */}
          <div className="w-48 h-64 flex-shrink-0 rounded-lg overflow-hidden bg-muted-gray/10 border border-muted-gray/20">
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt={displayName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-muted-gray/10">
                <User className="w-16 h-16 text-muted-gray/30" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-4xl font-heading text-bone-white mb-2">
              {displayName}
            </h1>

            {person.tagline && (
              <p className="text-lg text-muted-gray italic mb-3">{person.tagline}</p>
            )}

            {person.department && (
              <Badge
                variant="outline"
                className="text-xs border-accent-yellow/30 text-accent-yellow mb-4"
              >
                {person.department}
              </Badge>
            )}

            {person.bio && (
              <div className="mt-2">
                <p
                  className={`text-bone-white/70 text-sm leading-relaxed ${
                    !bioExpanded ? 'line-clamp-3' : ''
                  }`}
                >
                  {person.bio}
                </p>
                <button
                  onClick={() => setBioExpanded(!bioExpanded)}
                  className="text-accent-yellow text-sm mt-1 hover:underline"
                >
                  {bioExpanded ? 'Show less' : 'Read more'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Known For Section ────────────────────────────────────────── */}
        {knownFor.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-heading text-bone-white mb-4 flex items-center gap-2">
              <Film className="w-5 h-5 text-accent-yellow" />
              Known For
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted-gray/30">
              {knownFor.map((credit: any) => (
                <PosterCard key={credit.id} credit={credit} />
              ))}
            </div>
          </div>
        )}

        {/* ── Stats Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-heading text-accent-yellow">{totalCredits}</p>
            <p className="text-xs text-muted-gray mt-1">Total Credits</p>
          </div>
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-heading text-accent-yellow">{uniqueProductionCount}</p>
            <p className="text-xs text-muted-gray mt-1">Unique Productions</p>
          </div>
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 text-center">
            <p className="text-2xl font-heading text-accent-yellow">
              {earliestYear ?? '--'}
            </p>
            <p className="text-xs text-muted-gray mt-1">Active Since</p>
          </div>
        </div>

        {/* ── Filmography Section (grouped by position) ────────────────── */}
        {positionGroups.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-heading text-bone-white mb-4 flex items-center gap-2">
              <Film className="w-5 h-5" />
              Filmography
            </h2>
            <div className="space-y-3">
              {positionGroups.map(([position, groupCredits], index) => (
                <FilmographyGroup
                  key={position}
                  position={position}
                  credits={groupCredits}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {totalCredits === 0 && (
          <div className="text-center py-16 border-t border-muted-gray/20">
            <Briefcase className="w-12 h-12 text-muted-gray/30 mx-auto mb-3" />
            <p className="text-muted-gray">No credits listed yet.</p>
          </div>
        )}

        {/* ── View Full Profile link ───────────────────────────────────── */}
        {person.username && (
          <div className="mt-8 pt-6 border-t border-muted-gray/20 text-center">
            <Link to={`/profile/${person.username}`}>
              <Button
                variant="outline"
                className="text-accent-yellow border-accent-yellow/30 hover:bg-accent-yellow/10"
              >
                View Full Profile
                <ExternalLink className="w-3 h-3 ml-2" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default SlatePersonPage;
