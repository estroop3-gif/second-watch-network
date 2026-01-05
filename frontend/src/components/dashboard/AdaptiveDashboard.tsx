/**
 * AdaptiveDashboard
 * Role-based adaptive dashboard controller
 *
 * Renders dashboard sections based on user role with:
 * - Lazy-loaded section components
 * - Role-based section visibility
 * - Quick action bar
 * - Loading states with skeletons
 */

import React, { Suspense, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDashboardConfig, filterSectionsWithData } from '@/hooks/useDashboardConfig';
import { useDashboardSettings } from '@/context/DashboardSettingsContext';
import { useContinueWatching, useWatchlistItems, useWorlds } from '@/hooks/watch';
import { SECTION_COMPONENTS } from './config/sectionRegistry';
import { SectionSkeleton, HeroSkeleton } from './widgets/SectionSkeleton';
import { DashboardEditor, EditModeToolbar } from './customization';
import { Button } from '@/components/ui/button';
import { Settings2, Bookmark } from 'lucide-react';
import type { DashboardSectionConfig } from './config/dashboardConfig';

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 },
};

interface AdaptiveDashboardProps {
  className?: string;
}

export function AdaptiveDashboard({ className = '' }: AdaptiveDashboardProps) {
  const {
    sections,
    quickActions,
    effectiveRole,
    isLoading: configLoading,
    isAuthenticated,
  } = useDashboardConfig();

  // Dashboard customization state
  const dashboardSettings = useDashboardSettings();
  const {
    isEditing,
    enterEditMode,
    visibleSections: customizedSections,
  } = dashboardSettings;

  // Fetch data to determine which sections have content
  const { data: continueWatching } = useContinueWatching(6);
  const { data: watchlist } = useWatchlistItems(6);
  const { data: worldsData } = useWorlds({ limit: 12 });

  // Build data availability map
  const dataMap = useMemo(() => {
    const allWorlds = worldsData?.worlds || [];
    const featuredWorlds = allWorlds.filter(w => w.is_featured);
    const comingSoonWorlds = allWorlds.filter(w => w.status === 'coming_soon');
    const regularWorlds = allWorlds.filter(w => w.status === 'published' && !w.is_featured);

    return {
      'hero': featuredWorlds.length > 0,
      'for-you': true, // Always show - has fallback content for all users
      'continue-watching': (continueWatching?.length || 0) > 0,
      'watchlist': (watchlist?.length || 0) > 0,
      'featured-worlds': featuredWorlds.length > 0,
      'coming-soon': comingSoonWorlds.length > 0,
      'zine-picks': regularWorlds.length > 0,
      'undiscovered-heat': regularWorlds.length > 4,
      // New streaming widgets - fetch their own data
      'live-events': true, // Fetches own data, hides if empty
      'shorts-preview': true, // Fetches own data, hides if empty
      'greenroom-discovery': true, // Fetches own data, hides if empty
      // Creator/Backlot widgets - fetch their own data
      'creator-schedule': true, // Fetches own data, hides if empty
      'creator-dailies': true, // Fetches own data, hides if empty
      'creator-casting': true, // Fetches own data, hides if empty
      'creator-budget': true, // Fetches own data, hides if empty
      // Non-data-dependent sections
      'creator-projects': true,
      'creator-submissions': true,
      'friends-activity': true, // Fetches own data, hides if empty
      'creator-updates': true, // Fetches own data, hides if empty
      'watch-streaks': true, // Always show for authenticated users
      'achievements': true, // Always show for authenticated users
      'community-buzz': true, // Fetches own data, hides if empty
      'community-messages': true,
      'community-notifications': true,
      'order-dashboard': true,
      'order-jobs': true,
      'order-mentorship': true, // Fetches own data, hides if empty
      'admin-stats': true,
      'admin-pending': true,
    };
  }, [continueWatching, watchlist, worldsData]);

  // Filter sections based on data availability
  const visibleSections = useMemo(() => {
    return filterSectionsWithData(sections, dataMap);
  }, [sections, dataMap]);

  // Fixed sections that always appear first (in order)
  // Hero is handled separately, then For You, then Watchlist
  const FIXED_SECTION_IDS = ['hero', 'for-you', 'watchlist'] as const;

  // Separate fixed sections from role-specific sections
  const { heroSection, fixedSections, roleSpecificSections } = useMemo(() => {
    const hero = visibleSections.find(s => s.id === 'hero');
    const fixed = visibleSections.filter(s =>
      FIXED_SECTION_IDS.includes(s.id as typeof FIXED_SECTION_IDS[number]) && s.id !== 'hero'
    ).sort((a, b) => a.priority - b.priority);
    const roleSpecific = visibleSections.filter(s =>
      !FIXED_SECTION_IDS.includes(s.id as typeof FIXED_SECTION_IDS[number])
    );

    return { heroSection: hero, fixedSections: fixed, roleSpecificSections: roleSpecific };
  }, [visibleSections]);

  // Group role-specific sections by category for visual separation
  const groupedSections = useMemo(() => {
    const groups: Record<string, DashboardSectionConfig[]> = {
      admin: [],
      order: [],
      creator: [],
      streaming: [],
      community: [],
    };

    roleSpecificSections.forEach(section => {
      groups[section.category].push(section);
    });

    // Return in display order: admin > order > creator > streaming > community
    return [
      ...groups.admin,
      ...groups.order,
      ...groups.creator,
      ...groups.streaming,
      ...groups.community,
    ];
  }, [roleSpecificSections]);

  if (configLoading) {
    return (
      <div className={`container mx-auto px-4 py-8 ${className}`}>
        <HeroSkeleton className="mb-8" />
        <SectionSkeleton className="mb-8" />
        <SectionSkeleton className="mb-8" />
        <SectionSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      className={`container mx-auto px-4 py-8 ${className}`}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-start justify-between">
          <div className="text-center flex-1">
            <h1 className="text-3xl md:text-4xl font-heading tracking-tighter mb-2">
              Your Space on <span className="font-spray">Second Watch</span>
            </h1>
            <p className="text-gray-500 font-sans normal-case text-base">
              Built for rebels, creators, and story-finders.
            </p>
          </div>

          {/* Action buttons */}
          {isAuthenticated && !isEditing && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="gap-1.5"
              >
                <Link to="/watch/library">
                  <Bookmark className="h-4 w-4" />
                  <span className="hidden sm:inline">Watch List</span>
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={enterEditMode}
                className="text-gray-500 hover:text-bone-white gap-1.5"
              >
                <Settings2 className="h-4 w-4" />
                <span className="hidden sm:inline">Customize</span>
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Hero Section */}
      {heroSection && (
        <motion.div variants={itemVariants} className="mb-10">
          <Suspense fallback={<HeroSkeleton />}>
            <SectionRenderer config={heroSection} />
          </Suspense>
        </motion.div>
      )}

      {/* Fixed Sections (For You, Watchlist) - Always appear after Hero */}
      {fixedSections.length > 0 && (
        <div className="space-y-8 mb-8">
          {fixedSections.map(section => (
            <motion.div key={section.id} variants={itemVariants}>
              <Suspense fallback={<SectionSkeleton />}>
                <SectionRenderer config={section} />
              </Suspense>
            </motion.div>
          ))}
        </div>
      )}

      {/* Role-Specific Dashboard Sections */}
      {isEditing ? (
        <DashboardEditor renderSection={(sectionId) => {
          const Component = SECTION_COMPONENTS[sectionId];
          return Component ? (
            <Suspense fallback={<SectionSkeleton />}>
              <Component />
            </Suspense>
          ) : null;
        }}>
          {/* Children passed to DashboardEditor but not used directly */}
          <div />
        </DashboardEditor>
      ) : (
        <div className="space-y-8">
          {groupedSections.map((section, index) => (
            <motion.div
              key={section.id}
              variants={itemVariants}
            >
              {/* Add visual separator before streaming sections if there are admin/creator sections above */}
              {section.category === 'streaming' && index > 0 && groupedSections[index - 1].category !== 'streaming' && (
                <hr className="border-dashed border-muted-gray/30 mb-8" />
              )}

              <Suspense fallback={<SectionSkeleton />}>
                <SectionRenderer config={section} />
              </Suspense>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state for unauthenticated users */}
      {!isAuthenticated && visibleSections.length === 0 && (
        <motion.div variants={itemVariants} className="text-center py-16">
          <p className="text-gray-500 text-lg mb-4">
            Welcome to Second Watch Network
          </p>
          <p className="text-gray-500/70">
            Sign in to unlock your personalized dashboard.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Section renderer component
 * Renders the appropriate component for a section config
 */
function SectionRenderer({ config }: { config: DashboardSectionConfig }) {
  const Component = SECTION_COMPONENTS[config.id];

  if (!Component) {
    console.warn(`No component found for section: ${config.id}`);
    return null;
  }

  return <Component />;
}

export default AdaptiveDashboard;
