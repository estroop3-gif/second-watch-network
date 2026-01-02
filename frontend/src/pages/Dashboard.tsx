/**
 * Dashboard Page
 * Role-based adaptive dashboard for authenticated users
 *
 * Uses the AdaptiveDashboard component which:
 * - Shows sections based on user role (9-tier hierarchy)
 * - Focuses on content discovery (Netflix-style)
 * - Includes creator tools for filmmakers
 * - Shows admin widgets for staff
 *
 * Note: Authentication is handled by OnboardingGate wrapper in App.tsx.
 * AdaptiveDashboard has its own loading states for dashboard content.
 */

import { AdaptiveDashboard } from '@/components/dashboard/AdaptiveDashboard';

const Dashboard = () => {
  return <AdaptiveDashboard />;
};

export default Dashboard;
