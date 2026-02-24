/**
 * SlatePage - IMDB-style production detail page
 * Shows production info with hero section, horizontal cast/crew cards,
 * and collapsible department-grouped credits.
 * Accessible via /slate/:slug (no auth required)
 */
import React, { useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Film,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clapperboard,
} from 'lucide-react';
import { useProductionBySlug, useBacklotProjectForSlate } from '@/hooks/useProduction';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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

const SCROLL_VISIBLE_LIMIT = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getDisplayName(person: any): string {
  return person.full_name || person.display_name || person.username || 'Unknown';
}

/** Split cast_crew into Cast and Crew buckets */
function splitCastCrew(items: any[]): { cast: any[]; crew: any[] } {
  const cast: any[] = [];
  const crew: any[] = [];
  for (const item of items) {
    if (item.source === 'backlot_crew') {
      crew.push(item);
    } else {
      // 'backlot_cast' and 'credit' go into Cast
      cast.push(item);
    }
  }
  return { cast, crew };
}

/** Group items by department (crew uses `department`, credits group by `position`) */
function groupByDepartment(items: any[]): Record<string, any[]> {
  const groups: Record<string, any[]> = {};
  for (const item of items) {
    const key =
      item.source === 'backlot_crew' && item.department
        ? item.department
        : item.position || 'Other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  }
  // Sort groups alphabetically
  const sorted: Record<string, any[]> = {};
  for (const key of Object.keys(groups).sort()) {
    sorted[key] = groups[key];
  }
  return sorted;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** IMDB-style portrait card for horizontal scroll row */
const PersonCard: React.FC<{ person: any }> = ({ person }) => {
  const name = getDisplayName(person);
  const initials = getInitials(name);
  const role =
    person.character_name
      ? person.character_name
      : person.position || 'Credit';

  const card = (
    <div className="flex-shrink-0 w-24 snap-start group cursor-pointer">
      {/* Portrait photo */}
      <div className="w-24 h-32 rounded-lg overflow-hidden bg-muted-gray/10 border border-muted-gray/20 mb-2 group-hover:border-accent-yellow/40 transition-colors">
        {person.avatar_url ? (
          <img
            src={person.avatar_url}
            alt={name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-lg font-semibold text-muted-gray/50">
              {initials}
            </span>
          </div>
        )}
      </div>
      {/* Name */}
      <p className="text-sm font-semibold text-bone-white truncate group-hover:text-accent-yellow transition-colors">
        {name}
      </p>
      {/* Role */}
      <p className="text-xs text-muted-gray truncate">{role}</p>
    </div>
  );

  if (person.username) {
    return (
      <Link to={`/slate/person/${person.username}`} className="block flex-shrink-0">
        {card}
      </Link>
    );
  }

  return card;
};

/** Horizontal scrollable row of person cards with scroll arrows */
const PersonScrollRow: React.FC<{
  items: any[];
  label: string;
}> = ({ items, label }) => {
  const [showAll, setShowAll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  if (items.length === 0) return null;

  const displayItems = showAll ? items : items.slice(0, SCROLL_VISIBLE_LIMIT);
  const hasMore = items.length > SCROLL_VISIBLE_LIMIT;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-lg font-heading text-bone-white">{label}</h4>
        <div className="flex items-center gap-2">
          {hasMore && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-xs text-accent-yellow hover:text-accent-yellow/80 transition-colors"
            >
              {showAll ? 'Show less' : `See all ${items.length}`}
            </button>
          )}
          {!showAll && (
            <>
              <button
                onClick={() => scroll('left')}
                className="p-1 rounded-full bg-muted-gray/10 hover:bg-muted-gray/20 text-muted-gray hover:text-bone-white transition-colors"
                aria-label="Scroll left"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => scroll('right')}
                className="p-1 rounded-full bg-muted-gray/10 hover:bg-muted-gray/20 text-muted-gray hover:text-bone-white transition-colors"
                aria-label="Scroll right"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {showAll ? (
        /* Expanded grid */
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {displayItems.map((person: any) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      ) : (
        /* Horizontal scroll */
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 scrollbar-thin scrollbar-thumb-muted-gray/20 scrollbar-track-transparent"
        >
          {displayItems.map((person: any) => (
            <PersonCard key={person.id} person={person} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Collapsible department section for grouped credits */
const DepartmentSection: React.FC<{
  department: string;
  members: any[];
  defaultOpen?: boolean;
}> = ({ department, members, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-muted-gray/10 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3 px-1 hover:bg-muted-gray/5 transition-colors rounded"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-heading text-bone-white">{department}</span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-4 border-muted-gray/30 text-muted-gray"
          >
            {members.length}
          </Badge>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted-gray" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-gray" />
        )}
      </button>

      {open && (
        <div className="pb-3 pl-1 space-y-1">
          {members.map((person: any) => {
            const name = getDisplayName(person);
            const role = person.character_name || person.position || 'Credit';

            const row = (
              <div
                key={person.id}
                className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted-gray/5 transition-colors"
              >
                <span
                  className={`text-sm ${
                    person.username
                      ? 'text-accent-yellow hover:underline'
                      : 'text-bone-white'
                  }`}
                >
                  {name}
                </span>
                <span className="text-xs text-muted-gray ml-4 text-right flex-shrink-0">
                  {role}
                </span>
              </div>
            );

            if (person.username) {
              return (
                <Link key={person.id} to={`/slate/person/${person.username}`}>
                  {row}
                </Link>
              );
            }
            return row;
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

const SlateLoadingSkeleton: React.FC = () => (
  <div className="min-h-screen bg-charcoal-black">
    <div className="container mx-auto px-4 max-w-5xl py-8">
      {/* Back link skeleton */}
      <Skeleton className="h-5 w-16 mb-6" />

      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8 mb-10">
        <Skeleton className="w-full md:w-72 aspect-[2/3] rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-2/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-14" />
          </div>
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      {/* Cast & Crew */}
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-24">
            <Skeleton className="w-24 h-32 rounded-lg mb-2" />
            <Skeleton className="h-4 w-20 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

const SlatePage: React.FC<{ source?: 'production' | 'backlot' }> = ({ source = 'production' }) => {
  const { slug } = useParams<{ slug: string }>();

  const prodQuery = useProductionBySlug(source === 'production' ? slug : undefined);
  const backlotQuery = useBacklotProjectForSlate(source === 'backlot' ? slug : undefined);
  const { data: production, isLoading, error } = source === 'backlot' ? backlotQuery : prodQuery;

  if (isLoading) {
    return <SlateLoadingSkeleton />;
  }

  if (error || !production) {
    return (
      <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
        <div className="text-center">
          <Clapperboard className="w-16 h-16 text-muted-gray/30 mx-auto mb-4" />
          <h2 className="text-2xl font-heading text-bone-white mb-4">
            Production Not Found
          </h2>
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
  const { cast, crew } = splitCastCrew(castCrew);
  const allDepartments = groupByDepartment(castCrew);
  const runtime = formatRuntime(production.runtime_minutes);

  // Build IMDB-style metadata line: "2024 · Feature Film · Studio Name · 2h 3m"
  const metaParts: string[] = [];
  if (production.year) metaParts.push(String(production.year));
  if (production.production_type)
    metaParts.push(
      PRODUCTION_TYPE_LABELS[production.production_type] ||
        production.production_type
    );
  if (production.company) metaParts.push(production.company);
  if (runtime) metaParts.push(runtime);
  const metaLine = metaParts.join(' \u00B7 '); // middle dot separator

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Backdrop image (if present) */}
      {production.backdrop_url && (
        <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden">
          <img
            src={production.backdrop_url}
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal-black via-charcoal-black/60 to-transparent" />
        </div>
      )}

      <div
        className={`container mx-auto px-4 max-w-5xl ${
          production.backdrop_url ? '-mt-32 md:-mt-40 relative z-10' : 'pt-8'
        }`}
      >
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center text-muted-gray hover:text-bone-white transition-colors mb-6"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back
        </Link>

        {/* ============================================================ */}
        {/* Hero Section                                                  */}
        {/* ============================================================ */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          {/* Poster */}
          <div className="w-full md:w-72 flex-shrink-0">
            {production.poster_url ? (
              <img
                src={production.poster_url}
                alt={production.name}
                className="w-full rounded-lg shadow-2xl object-cover aspect-[2/3]"
              />
            ) : (
              <div className="w-full rounded-lg bg-muted-gray/10 border border-muted-gray/20 flex items-center justify-center aspect-[2/3] shadow-2xl">
                <Film className="w-20 h-20 text-muted-gray/30" />
              </div>
            )}
          </div>

          {/* Production Info */}
          <div className="flex-1 min-w-0">
            {/* Status badge */}
            {production.status && (
              <div className="mb-3">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    STATUS_COLORS[production.status] ||
                    'bg-muted-gray/20 text-muted-gray'
                  }`}
                >
                  {STATUS_LABELS[production.status] || production.status}
                </Badge>
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-heading text-bone-white mb-2 leading-tight">
              {production.name}
            </h1>

            {/* Metadata line */}
            {metaLine && (
              <p className="text-muted-gray text-sm md:text-base mb-4">
                {metaLine}
              </p>
            )}

            {/* Tagline */}
            {production.tagline && (
              <p className="text-bone-white/70 text-lg italic mb-2">
                "{production.tagline}"
              </p>
            )}

            {/* Genre badges */}
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

            {/* Logline */}
            {production.logline && (
              <p className="text-bone-white/80 text-base italic mb-4">
                "{production.logline}"
              </p>
            )}

            {/* Description */}
            {production.description && (
              <p className="text-muted-gray leading-relaxed mb-4">
                {production.description}
              </p>
            )}

            {/* Backlot project link */}
            {production.backlot_slug && (
              <div className="mt-2">
                <Link to={`/projects/${production.backlot_slug}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-accent-yellow border-accent-yellow/30 hover:bg-accent-yellow/10"
                  >
                    <Clapperboard className="w-4 h-4 mr-2" />
                    View Backlot Project
                    <ExternalLink className="w-3 h-3 ml-2" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* Cast & Crew — Photo Cards (horizontal scroll)                */}
        {/* ============================================================ */}
        {castCrew.length > 0 && (
          <div className="border-t border-muted-gray/20 pt-8 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Users className="w-6 h-6 text-bone-white" />
              <h2 className="text-2xl font-heading text-bone-white">
                Cast & Crew
              </h2>
              <Badge
                variant="outline"
                className="text-xs border-muted-gray/30 text-muted-gray"
              >
                {castCrew.length}
              </Badge>
            </div>

            {/* Cast row */}
            {cast.length > 0 && (
              <PersonScrollRow items={cast} label="Cast" />
            )}

            {/* Crew row */}
            {crew.length > 0 && (
              <PersonScrollRow items={crew} label="Crew" />
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* Department Grouping (collapsible)                             */}
        {/* ============================================================ */}
        {castCrew.length > 0 && Object.keys(allDepartments).length > 0 && (
          <div className="border-t border-muted-gray/20 pt-8 mb-12">
            <h3 className="text-xl font-heading text-bone-white mb-4">
              Full Credits
            </h3>
            <div className="bg-muted-gray/5 rounded-lg border border-muted-gray/10 divide-y divide-muted-gray/10">
              {Object.entries(allDepartments).map(
                ([department, members], idx) => (
                  <DepartmentSection
                    key={department}
                    department={department}
                    members={members}
                    defaultOpen={idx === 0}
                  />
                )
              )}
            </div>
          </div>
        )}

        {/* Empty state when no credits */}
        {castCrew.length === 0 && (
          <div className="border-t border-muted-gray/20 pt-8 mb-12">
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

export default SlatePage;
