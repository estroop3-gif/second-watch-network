/**
 * Dashboard Section Registry
 * Lazy-loaded component mappings for each dashboard section
 */

import { lazy, ComponentType } from 'react';
import type { DashboardSectionId } from './dashboardConfig';

// Section component props interface
export interface SectionProps {
  className?: string;
}

// Registry type
type SectionRegistry = Record<DashboardSectionId, ComponentType<SectionProps>>;

/**
 * Lazy-loaded section components
 * Each section is code-split for optimal loading
 */
export const SECTION_COMPONENTS: SectionRegistry = {
  // Streaming sections
  'hero': lazy(() => import('../sections/HeroSection')),
  'for-you': lazy(() => import('../sections/streaming/ForYouSection')),
  'continue-watching': lazy(() => import('../sections/streaming/ContinueWatchingSection')),
  'watchlist': lazy(() => import('../sections/streaming/WatchlistSection')),
  'featured-worlds': lazy(() => import('../sections/streaming/FeaturedWorldsSection')),
  'coming-soon': lazy(() => import('../sections/streaming/ComingSoonSection')),
  'zine-picks': lazy(() => import('../sections/streaming/ZinePicksSection')),
  'undiscovered-heat': lazy(() => import('../sections/streaming/UndiscoveredHeatSection')),
  'live-events': lazy(() => import('../sections/streaming/LiveEventsWidget')),
  'shorts-preview': lazy(() => import('../sections/streaming/ShortsWidget')),
  'greenroom-discovery': lazy(() => import('../sections/streaming/GreenRoomWidget')),

  // Creator sections
  'creator-projects': lazy(() => import('../sections/creator/CreatorProjectsSection')),
  'creator-submissions': lazy(() => import('../sections/creator/CreatorSubmissionsSection')),
  'creator-schedule': lazy(() => import('../sections/creator/ScheduleWidget')),
  'creator-dailies': lazy(() => import('../sections/creator/DailiesWidget')),
  'creator-casting': lazy(() => import('../sections/creator/CastingWidget')),
  'creator-budget': lazy(() => import('../sections/creator/BudgetWidget')),
  'creator-organizations': lazy(() => import('../sections/creator/OrganizationsWidget')),

  // Social sections
  'friends-activity': lazy(() => import('../sections/social/FriendsActivityWidget')),
  'creator-updates': lazy(() => import('../sections/social/CreatorUpdatesWidget')),

  // Engagement sections
  'watch-streaks': lazy(() => import('../sections/engagement/WatchStreaksWidget')),
  'achievements': lazy(() => import('../sections/engagement/AchievementsWidget')),

  // Community sections
  'community-buzz': lazy(() => import('../sections/community/CommunityBuzzWidget')),
  'community-messages': lazy(() => import('../sections/community/MessagesWidget')),
  'community-notifications': lazy(() => import('../sections/community/NotificationsWidget')),

  // Order sections
  'order-dashboard': lazy(() => import('../sections/order/OrderDashboardSection')),
  'order-jobs': lazy(() => import('../sections/order/OrderJobsSection')),
  'order-mentorship': lazy(() => import('../sections/order/MentorshipWidget')),

  // CRM sections
  'crm-overview': lazy(() => import('../sections/crm/CRMOverviewWidget')),

  // Admin sections
  'admin-stats': lazy(() => import('../sections/admin/AdminStatsWidget')),
  'admin-pending': lazy(() => import('../sections/admin/AdminPendingWidget')),
};

/**
 * Get the component for a section ID
 */
export function getSectionComponent(sectionId: DashboardSectionId): ComponentType<SectionProps> {
  return SECTION_COMPONENTS[sectionId];
}
