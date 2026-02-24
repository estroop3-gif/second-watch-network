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

// ─── Department Sort Order (IMDB-style hierarchy) ───────────────────────────

const DEPARTMENT_SORT_ORDER: Record<string, number> = {
  // Talent / Cast (1–9)
  'Actor': 1,
  'Voice Actor': 2,
  'Background Actor / Extra': 3,
  'Stand-In': 4,
  'Photo Double': 5,
  'Stunt Performer': 6,
  'Stunt Double': 7,
  'Stunt Coordinator': 8,
  'Fight Choreographer': 9,

  // Direction (10–14)
  'Director': 10,
  '1st Assistant Director': 11,
  '2nd Assistant Director': 12,
  '2nd 2nd Assistant Director': 13,
  'Script Supervisor': 14,

  // Writing (15–19)
  'Screenwriter': 15,
  'Staff Writer': 16,
  'Story Editor': 17,
  'Script Doctor': 18,

  // Production (20–29)
  'Producer': 20,
  'Executive Producer': 21,
  'Line Producer': 22,
  'Co-Producer': 23,
  'Associate Producer': 24,
  'Unit Production Manager (UPM)': 25,
  'Production Supervisor': 26,
  'Production Coordinator': 27,
  'Production Secretary': 28,
  'Production Assistant (PA)': 29,
  'Office PA': 29,
  'Set PA': 29,

  // Camera (30–39)
  'Director of Photography (DP)': 30,
  'Cinematographer': 31,
  'Camera Operator': 32,
  '1st Assistant Camera (Focus Puller)': 33,
  '2nd Assistant Camera (Clapper/Loader)': 34,
  'Digital Imaging Technician (DIT)': 35,
  'Steadicam Operator': 36,
  'Drone Operator': 37,
  'Camera Trainee': 38,

  // Lighting & Grip (40–49)
  'Gaffer': 40,
  'Best Boy Electric': 41,
  'Electrician': 42,
  'Lamp Operator': 43,
  'Rigging Gaffer': 44,
  'Key Grip': 45,
  'Best Boy Grip': 46,
  'Dolly Grip': 47,
  'Grip': 48,
  'Rigging Grip': 49,

  // Post-Production (50–54)
  'Editor': 50,
  'Assistant Editor': 51,
  'Post-Production Supervisor': 52,
  'Post-Production Coordinator': 53,
  'Colorist': 54,
  'Online Editor': 55,
  'Dailies Operator': 56,

  // Sound (57–64)
  'Production Sound Mixer': 57,
  'Sound Mixer': 58,
  'Boom Operator': 59,
  'Sound Utility': 60,
  'Sound Assistant': 61,
  'Sound Designer': 62,
  'Supervising Sound Editor': 63,
  'Dialogue Editor': 64,
  'Sound Effects Editor': 65,
  'Foley Artist': 66,
  'Foley Mixer': 67,
  'ADR Supervisor': 68,
  'Re-Recording Mixer': 69,
  'Playback Operator': 70,

  // VFX (71–79)
  'VFX Supervisor': 71,
  'VFX Producer': 72,
  'VFX Coordinator': 73,
  'VFX Artist': 74,
  'Compositor': 75,
  'Roto Artist': 76,
  'Matchmove Artist': 77,
  '3D Artist': 78,
  'Matte Painter': 79,

  // Art Department (80–84)
  'Production Designer': 80,
  'Art Director': 81,
  'Assistant Art Director': 82,
  'Set Designer': 83,
  'Set Decorator': 84,
  'Leadman': 85,
  'Set Dresser': 86,
  'Property Master': 87,
  'Property Assistant': 88,
  'Buyer': 89,
  'Art Department Coordinator': 90,
  'Scenic Artist': 91,
  'Graphic Designer': 92,

  // Wardrobe (93–95)
  'Costume Designer': 93,
  'Assistant Costume Designer': 94,
  'Costume Supervisor': 95,
  'Key Costumer': 96,
  'Costumer': 97,
  'Wardrobe Assistant': 98,

  // Music (100–103)
  'Composer': 100,
  'Music Supervisor': 101,
  'Music Editor': 102,
  'Music Coordinator': 103,
};

function getPositionSortKey(position: string): number {
  return DEPARTMENT_SORT_ORDER[position] ?? 99;
}

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
      {/* Filmography skeleton — IMDB poster row style */}
      {[...Array(3)].map((_, g) => (
        <div key={g} className="mb-8">
          <div className="flex items-center gap-3 py-2 border-b-2 border-muted-gray/20 mb-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          {[...Array(3)].map((_, r) => (
            <div key={r} className="flex items-start gap-3 py-3 px-2">
              <Skeleton className="w-[46px] h-[68px] rounded flex-shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ))}
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
  description?: string | null;
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
      {credit.description && (
        <p className="text-xs text-muted-gray/50 truncate">{credit.description}</p>
      )}
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

// ─── IMDB-Style Filmography Credit Row ──────────────────────────────────────

const FilmographyCreditRow: React.FC<{ credit: any }> = ({ credit }) => {
  const inner = (
    <div className="flex items-start gap-3 py-3 px-2 hover:bg-muted-gray/5 rounded transition-colors group">
      {/* Poster thumbnail — like IMDB's redesigned name page */}
      <div className="w-[46px] h-[68px] flex-shrink-0 rounded overflow-hidden bg-muted-gray/10">
        {credit.poster_url ? (
          <img
            src={credit.poster_url}
            alt={credit.production_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-5 h-5 text-muted-gray/20" />
          </div>
        )}
      </div>

      {/* Credit info */}
      <div className="flex-1 min-w-0 py-0.5">
        {/* Title */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-bone-white group-hover:text-accent-yellow transition-colors truncate">
            {credit.production_name}
          </span>
          {credit.source === 'backlot' && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30 font-medium flex-shrink-0">
              Backlot
            </Badge>
          )}
        </div>

        {/* Year + production type */}
        <div className="flex items-center gap-2 mt-0.5">
          {credit.year && (
            <span className="text-sm tabular-nums text-muted-gray">{credit.year}</span>
          )}
          {credit.production_type && (
            <span className="text-xs text-muted-gray/60">
              {PRODUCTION_TYPE_LABELS[credit.production_type] || credit.production_type}
            </span>
          )}
        </div>

        {/* Character / role description */}
        {credit.description && (
          <p className="text-sm text-muted-gray/80 mt-0.5 truncate">
            {credit.description}
          </p>
        )}
      </div>
    </div>
  );

  if (credit.production_slug) {
    return (
      <Link to={`/slate/${credit.production_slug}`} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
};

// ─── IMDB-Style Filmography Group (Collapsible) ─────────────────────────────

interface IMDBFilmographyGroupProps {
  position: string;
  credits: any[];
  defaultOpen: boolean;
}

const IMDBFilmographyGroup: React.FC<IMDBFilmographyGroupProps> = ({ position, credits, defaultOpen }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Sort: year desc, backlot (no year) to bottom
  const sorted = useMemo(
    () => [...credits].sort((a, b) => {
      if (a.year && b.year) return b.year - a.year;
      if (a.year && !b.year) return -1;
      if (!a.year && b.year) return 1;
      return a.production_name.localeCompare(b.production_name);
    }),
    [credits]
  );

  return (
    <div className="mb-8">
      {/* Group header — IMDB style: bold category with yellow accent bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-2 border-b-2 border-accent-yellow/40 hover:border-accent-yellow transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-bone-white font-heading text-lg">{position}</span>
          <span className="text-sm text-muted-gray">
            {credits.length} {credits.length === 1 ? 'credit' : 'credits'}
          </span>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-gray" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-gray" />
        )}
      </button>

      {/* Credit rows with poster thumbnails */}
      {isOpen && (
        <div className="mt-1">
          {sorted.map((credit) => (
            <FilmographyCreditRow key={credit.id} credit={credit} />
          ))}
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
      description: c.description || null,
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
    // Sort groups by IMDB department hierarchy (talent first, then direction, etc.)
    const positionGroups = Object.entries(groupedByPosition).sort(
      ([posA], [posB]) => getPositionSortKey(posA) - getPositionSortKey(posB)
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
            <div>
              {positionGroups.map(([position, groupCredits], index) => (
                <IMDBFilmographyGroup
                  key={position}
                  position={position}
                  credits={groupCredits}
                  defaultOpen={index < 3}
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
