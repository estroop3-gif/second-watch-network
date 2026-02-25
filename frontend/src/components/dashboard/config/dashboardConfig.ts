/**
 * Dashboard Configuration System
 * Defines which sections are visible to which roles
 */

import type { RoleType } from '@/lib/badges/userBadges';

// All possible dashboard section identifiers
export type DashboardSectionId =
  | 'media-overview'
  | 'hero'
  | 'for-you'
  | 'continue-watching'
  | 'watchlist'
  | 'featured-worlds'
  | 'coming-soon'
  | 'zine-picks'
  | 'undiscovered-heat'
  | 'live-events'
  | 'shorts-preview'
  | 'greenroom-discovery'
  | 'creator-projects'
  | 'creator-submissions'
  | 'creator-schedule'
  | 'creator-dailies'
  | 'creator-casting'
  | 'creator-budget'
  | 'creator-organizations'
  | 'friends-activity'
  | 'creator-updates'
  | 'watch-streaks'
  | 'achievements'
  | 'community-buzz'
  | 'community-messages'
  | 'community-notifications'
  | 'order-dashboard'
  | 'order-jobs'
  | 'order-mentorship'
  | 'crm-overview'
  | 'admin-stats'
  | 'admin-pending';

// Section categories for grouping
export type SectionCategory = 'streaming' | 'creator' | 'community' | 'order' | 'crm' | 'media' | 'admin';

// Configuration for each dashboard section
export interface DashboardSectionConfig {
  id: DashboardSectionId;
  title: string;
  priority: number; // Lower = higher on page
  requiresAuth: boolean;
  requiresData: boolean; // Hide section if data is empty
  roles: RoleType[]; // Which roles can see this section
  category: SectionCategory;
  description?: string;
}

// Quick action button configuration
export interface QuickAction {
  id: string;
  label: string;
  icon: string; // Lucide icon name
  href: string;
  roles: RoleType[];
  variant?: 'default' | 'outline' | 'ghost';
}

// Role groups for easier configuration
const ALL_ROLES: RoleType[] = [
  'superadmin', 'admin', 'moderator', 'sales_admin', 'lodge_officer',
  'order_member', 'sales_agent', 'sales_rep', 'media_team', 'partner', 'filmmaker', 'premium', 'free'
];

const AUTHENTICATED_ROLES: RoleType[] = [
  'superadmin', 'admin', 'moderator', 'sales_admin', 'lodge_officer',
  'order_member', 'sales_agent', 'sales_rep', 'media_team', 'partner', 'filmmaker', 'premium'
];

const CRM_ROLES: RoleType[] = ['superadmin', 'admin', 'sales_admin', 'sales_agent', 'sales_rep'];

const STAFF_ROLES: RoleType[] = ['superadmin', 'admin', 'moderator'];

const ORDER_ROLES: RoleType[] = ['superadmin', 'admin', 'moderator', 'lodge_officer', 'order_member', 'sales_rep'];

const MEDIA_ROLES: RoleType[] = ['superadmin', 'admin', 'media_team'];

const CREATOR_ROLES: RoleType[] = ['superadmin', 'admin', 'moderator', 'filmmaker', 'partner', 'sales_rep'];

/**
 * Dashboard Section Configurations
 * Ordered by priority (lower number = appears higher)
 */
export const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  // STREAMING SECTIONS (Primary Focus)
  // Hero, For You, and Watchlist are FIXED first 3 sections for all roles
  {
    id: 'hero',
    title: 'Featured',
    priority: 0,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Featured world hero banner',
  },
  {
    id: 'for-you',
    title: 'For You',
    priority: 1, // Always second after hero
    requiresAuth: false, // Shows "Watch Free" for guests
    requiresData: false, // Always show (has fallback content)
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Personalized recommendations (or free content for guests)',
  },
  {
    id: 'watchlist',
    title: 'Saved For Later',
    priority: 2, // Always third
    requiresAuth: true,
    requiresData: true,
    roles: AUTHENTICATED_ROLES,
    category: 'streaming',
    description: 'Your saved watchlist items',
  },
  // Role-specific and other streaming sections after the fixed 3
  {
    id: 'continue-watching',
    title: 'Continue Watching',
    priority: 100, // After role-specific sections
    requiresAuth: true,
    requiresData: true,
    roles: AUTHENTICATED_ROLES,
    category: 'streaming',
    description: 'Resume where you left off',
  },
  {
    id: 'featured-worlds',
    title: 'Featured Artists',
    priority: 110,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Highlighted creator worlds',
  },
  {
    id: 'coming-soon',
    title: 'Coming Soon',
    priority: 120,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Upcoming releases',
  },
  {
    id: 'zine-picks',
    title: 'Zine Picks',
    priority: 130,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Staff curated selections',
  },
  {
    id: 'undiscovered-heat',
    title: 'Undiscovered Heat',
    priority: 140,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Hidden gems waiting to be discovered',
  },
  {
    id: 'live-events',
    title: 'Live & Upcoming',
    priority: 3, // Right after the fixed 3 sections
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Live events, premieres, and watch parties',
  },
  {
    id: 'shorts-preview',
    title: 'Shorts',
    priority: 4,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Trending short-form videos',
  },
  {
    id: 'greenroom-discovery',
    title: 'Green Room',
    priority: 90, // Before continue-watching
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'streaming',
    description: 'Vote on upcoming projects',
  },

  // CREATOR SECTIONS (after hero, for-you, watchlist)
  {
    id: 'creator-projects',
    title: 'My Productions',
    priority: 10, // Role-specific sections: 10-50
    requiresAuth: true,
    requiresData: false,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Your Backlot projects',
  },
  {
    id: 'creator-submissions',
    title: 'Submissions',
    priority: 11,
    requiresAuth: true,
    requiresData: false,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Your film submissions',
  },
  {
    id: 'creator-schedule',
    title: 'Production Schedule',
    priority: 12,
    requiresAuth: true,
    requiresData: true,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Upcoming shoot days across projects',
  },
  {
    id: 'creator-dailies',
    title: 'Dailies',
    priority: 13,
    requiresAuth: true,
    requiresData: true,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Recent footage uploads and storage',
  },
  {
    id: 'creator-casting',
    title: 'Casting Pipeline',
    priority: 14,
    requiresAuth: true,
    requiresData: true,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Open roles and pending applications',
  },
  {
    id: 'creator-budget',
    title: 'Budget Overview',
    priority: 15,
    requiresAuth: true,
    requiresData: true,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Budget health and pending approvals',
  },
  {
    id: 'creator-organizations',
    title: 'Organizations',
    priority: 16,
    requiresAuth: true,
    requiresData: true,
    roles: CREATOR_ROLES,
    category: 'creator',
    description: 'Organizations with Backlot access',
  },

  // SOCIAL SECTIONS
  {
    id: 'friends-activity',
    title: 'Friends Activity',
    priority: 145, // Before community sections
    requiresAuth: true,
    requiresData: true,
    roles: AUTHENTICATED_ROLES,
    category: 'community',
    description: 'What your friends are watching',
  },
  {
    id: 'creator-updates',
    title: 'Creator Updates',
    priority: 146,
    requiresAuth: true,
    requiresData: true,
    roles: AUTHENTICATED_ROLES,
    category: 'community',
    description: 'Announcements from worlds you follow',
  },

  // ENGAGEMENT SECTIONS
  {
    id: 'watch-streaks',
    title: 'Watch Streak',
    priority: 147,
    requiresAuth: true,
    requiresData: false,
    roles: AUTHENTICATED_ROLES,
    category: 'community',
    description: 'Your watch streak and statistics',
  },
  {
    id: 'achievements',
    title: 'Achievements',
    priority: 149,
    requiresAuth: true,
    requiresData: false,
    roles: AUTHENTICATED_ROLES,
    category: 'community',
    description: 'Your earned badges and progress',
  },

  // COMMUNITY SECTIONS
  {
    id: 'community-buzz',
    title: 'Community Buzz',
    priority: 148,
    requiresAuth: false,
    requiresData: true,
    roles: ALL_ROLES,
    category: 'community',
    description: 'Trending community discussions',
  },
  {
    id: 'community-messages',
    title: 'Messages',
    priority: 150, // After streaming sections
    requiresAuth: true,
    requiresData: true,
    roles: AUTHENTICATED_ROLES,
    category: 'community',
    description: 'Recent messages',
  },
  {
    id: 'community-notifications',
    title: 'Activity',
    priority: 151,
    requiresAuth: true,
    requiresData: true,
    roles: AUTHENTICATED_ROLES,
    category: 'community',
    description: 'Recent notifications',
  },

  // ORDER SECTIONS (after hero, for-you, watchlist)
  {
    id: 'order-dashboard',
    title: 'Order Dashboard',
    priority: 20, // Role-specific sections: 10-50
    requiresAuth: true,
    requiresData: false,
    roles: ORDER_ROLES,
    category: 'order',
    description: 'The Order overview',
  },
  {
    id: 'order-jobs',
    title: 'Job Board',
    priority: 21,
    requiresAuth: true,
    requiresData: true,
    roles: ORDER_ROLES,
    category: 'order',
    description: 'Available production jobs',
  },
  {
    id: 'order-mentorship',
    title: 'Professional Growth',
    priority: 22,
    requiresAuth: true,
    requiresData: true,
    roles: ORDER_ROLES,
    category: 'order',
    description: 'CraftHouse progression and mentorship',
  },

  // CRM SECTION (sales agents)
  {
    id: 'crm-overview',
    title: 'CRM Overview',
    priority: 9,
    requiresAuth: true,
    requiresData: false,
    roles: CRM_ROLES,
    category: 'crm',
    description: "Today's interaction counts and upcoming follow-ups",
  },

  // MEDIA SECTION (media team)
  {
    id: 'media-overview',
    title: 'Media Hub',
    priority: 9,
    requiresAuth: true,
    requiresData: false,
    roles: MEDIA_ROLES,
    category: 'media',
    description: 'Pending content requests and upcoming scheduled posts',
  },

  // ADMIN SECTIONS (widgets only, full admin at /admin)
  {
    id: 'admin-stats',
    title: 'Platform Stats',
    priority: 5,
    requiresAuth: true,
    requiresData: false,
    roles: STAFF_ROLES,
    category: 'admin',
    description: 'Quick platform statistics',
  },
  {
    id: 'admin-pending',
    title: 'Pending Review',
    priority: 8,
    requiresAuth: true,
    requiresData: true,
    roles: STAFF_ROLES,
    category: 'admin',
    description: 'Items awaiting approval',
  },
];

/**
 * Quick Actions Configuration
 * Role-based quick action buttons
 */
export const QUICK_ACTIONS: QuickAction[] = [
  // Free users
  {
    id: 'browse',
    label: 'Browse',
    icon: 'Film',
    href: '/watch',
    roles: ALL_ROLES,
  },
  {
    id: 'search',
    label: 'Search',
    icon: 'Search',
    href: '/search',
    roles: ALL_ROLES,
  },
  {
    id: 'upgrade',
    label: 'Upgrade',
    icon: 'Sparkles',
    href: '/upgrade',
    roles: ['free'],
    variant: 'default',
  },

  // Premium users
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: 'Bookmark',
    href: '/watchlist',
    roles: AUTHENTICATED_ROLES,
  },
  {
    id: 'messages',
    label: 'Messages',
    icon: 'MessageSquare',
    href: '/messages',
    roles: AUTHENTICATED_ROLES,
  },

  // Filmmakers
  {
    id: 'new-project',
    label: 'New Project',
    icon: 'Plus',
    href: '/backlot/new',
    roles: CREATOR_ROLES,
    variant: 'default',
  },
  {
    id: 'submissions',
    label: 'Submissions',
    icon: 'Upload',
    href: '/submissions',
    roles: CREATOR_ROLES,
  },
  {
    id: 'greenroom',
    label: 'Green Room',
    icon: 'Users',
    href: '/greenroom',
    roles: CREATOR_ROLES,
  },

  // Filmmaker Pro
  {
    id: 'filmmaker-pro',
    label: 'Pro Tools',
    icon: 'Sparkles',
    href: '/filmmaker-pro',
    roles: ['superadmin', 'admin', 'filmmaker'] as RoleType[],
  },

  // Order members
  {
    id: 'directory',
    label: 'Directory',
    icon: 'Contact',
    href: '/order/directory',
    roles: ORDER_ROLES,
  },
  {
    id: 'jobs',
    label: 'Jobs',
    icon: 'Briefcase',
    href: '/order/jobs',
    roles: ORDER_ROLES,
  },
  {
    id: 'lodge',
    label: 'Lodge',
    icon: 'Building',
    href: '/order/lodge',
    roles: ORDER_ROLES,
  },

  // Sales agents
  {
    id: 'crm',
    label: 'CRM',
    icon: 'Users',
    href: '/crm',
    roles: CRM_ROLES,
    variant: 'outline',
  },

  // Media team
  {
    id: 'media-hub',
    label: 'Media Hub',
    icon: 'Video',
    href: '/media',
    roles: MEDIA_ROLES,
    variant: 'outline',
  },

  // Staff
  {
    id: 'admin-panel',
    label: 'Admin',
    icon: 'Shield',
    href: '/admin',
    roles: STAFF_ROLES,
    variant: 'outline',
  },
];

/**
 * Get sections visible to a specific role
 */
export function getSectionsForRole(role: RoleType): DashboardSectionConfig[] {
  return DASHBOARD_SECTIONS
    .filter(section => section.roles.includes(role))
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Get quick actions available to a specific role
 */
export function getQuickActionsForRole(role: RoleType): QuickAction[] {
  return QUICK_ACTIONS.filter(action => action.roles.includes(role));
}

/**
 * Check if a role can see a specific section
 */
export function canRoleSeeSection(role: RoleType, sectionId: DashboardSectionId): boolean {
  const section = DASHBOARD_SECTIONS.find(s => s.id === sectionId);
  return section ? section.roles.includes(role) : false;
}

/**
 * Get the highest role from an array of roles
 * Used when user has multiple roles
 */
export function getHighestRole(roles: RoleType[]): RoleType {
  const rolePriority: Record<RoleType, number> = {
    superadmin: 1,
    admin: 2,
    moderator: 3,
    sales_admin: 4,
    lodge_officer: 5,
    order_member: 6,
    sales_agent: 7,
    sales_rep: 8,
    media_team: 9,
    partner: 10,
    filmmaker: 11,
    premium: 12,
    free: 13,
  };

  return roles.reduce((highest, current) => {
    return rolePriority[current] < rolePriority[highest] ? current : highest;
  }, 'free' as RoleType);
}
