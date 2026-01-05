/**
 * DashboardFree Page
 * Redirects to main Dashboard - the AdaptiveDashboard handles role-based content
 *
 * This file is kept for backwards compatibility with any existing routes.
 * The main Dashboard now uses AdaptiveDashboard which shows appropriate
 * content based on user role (including free tier users).
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdaptiveDashboard } from '@/components/dashboard/AdaptiveDashboard';

const DashboardFree = () => {
  const navigate = useNavigate();

  // Optionally redirect to main dashboard
  // For now, we'll render the same AdaptiveDashboard which handles free users
  useEffect(() => {
    // Could redirect: navigate('/dashboard', { replace: true });
  }, [navigate]);

  return <AdaptiveDashboard />;
};

export default DashboardFree;
