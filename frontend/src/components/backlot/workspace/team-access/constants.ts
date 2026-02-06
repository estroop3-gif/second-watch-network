/**
 * Shared constants for the Team & Access component tree
 */

export const TAB_DEFINITIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'script', label: 'Script' },
  { key: 'shot-lists', label: 'Shot Lists' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'call-sheets', label: 'Call Sheets' },
  { key: 'casting', label: 'Casting' },
  { key: 'locations', label: 'Locations' },
  { key: 'gear', label: 'Gear' },
  { key: 'dailies', label: 'Dailies' },
  { key: 'review', label: 'Review' },
  { key: 'assets', label: 'Assets' },
  { key: 'budget', label: 'Budget' },
  { key: 'daily-budget', label: 'Daily Budget' },
  { key: 'receipts', label: 'Receipts' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'updates', label: 'Updates' },
  { key: 'contacts', label: 'Contacts' },
  { key: 'clearances', label: 'Clearances' },
  { key: 'credits', label: 'Credits' },
  { key: 'settings', label: 'Settings' },
  { key: 'timecards', label: 'Timecards' },
  { key: 'scene-view', label: 'Scene View' },
  { key: 'day-view', label: 'Day View' },
  { key: 'person-view', label: 'Person View' },
  { key: 'access', label: 'Team & Access' },
] as const;

export const SECTION_DEFINITIONS = [
  { key: 'budget_numbers', label: 'Budget Numbers' },
  { key: 'admin_tools', label: 'Admin Tools' },
] as const;

export const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  editor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  viewer: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
};

export const BACKLOT_ROLE_COLORS: Record<string, string> = {
  showrunner: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  producer: 'bg-green-500/20 text-green-400 border-green-500/30',
  director: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  first_ad: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  dp: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  editor: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  department_head: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  crew: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
};

/** Standard client view preset: tabs visible by default for client seats */
export const STANDARD_CLIENT_TABS = [
  'overview',
  'schedule',
  'call-sheets',
  'dailies',
  'review',
  'updates',
];
