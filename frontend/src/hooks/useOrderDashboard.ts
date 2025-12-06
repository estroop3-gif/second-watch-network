/**
 * Hook for fetching Order Dashboard data
 * Fetches all data needed for The Order Dashboard in a single hook
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import {
  orderAPI,
  OrderDashboardStats,
  OrderMemberProfile,
  OrderBookingRequest,
  OrderJobApplication,
  OrderJob,
  Lodge,
  LodgeMembership,
  OrderApplication,
} from '@/lib/api/order';

export interface OrderDashboardData {
  // Core stats
  dashboard: OrderDashboardStats | null;
  profile: OrderMemberProfile | null;
  application: OrderApplication | null;

  // Activity data
  bookingRequests: OrderBookingRequest[];
  jobApplications: OrderJobApplication[];
  jobsForYou: OrderJob[];

  // Lodge data
  lodgeMemberships: LodgeMembership[];
  currentLodge: Lodge | null;

  // Loading states
  isLoading: boolean;
  isError: boolean;
  error: Error | null;

  // Refetch function
  refetch: () => void;
}

export function useOrderDashboard(): OrderDashboardData {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Fetch dashboard stats
  const dashboardQuery = useQuery({
    queryKey: ['order-dashboard', user?.id],
    queryFn: () => orderAPI.getDashboard(),
    enabled: isAuthenticated,
    retry: 1,
  });

  // Fetch user's Order profile
  const profileQuery = useQuery({
    queryKey: ['order-profile', user?.id],
    queryFn: () => orderAPI.getMyProfile(),
    enabled: isAuthenticated && dashboardQuery.data?.is_order_member === true,
    retry: 1,
  });

  // Fetch user's application (for non-members)
  const applicationQuery = useQuery({
    queryKey: ['order-application', user?.id],
    queryFn: () => orderAPI.getMyApplication(),
    enabled: isAuthenticated && dashboardQuery.data?.is_order_member === false,
    retry: 1,
  });

  // Fetch booking requests
  const bookingRequestsQuery = useQuery({
    queryKey: ['order-booking-requests', user?.id],
    queryFn: () => orderAPI.getMyBookingRequests(),
    enabled: isAuthenticated && dashboardQuery.data?.is_order_member === true,
    retry: 1,
  });

  // Fetch job applications
  const jobApplicationsQuery = useQuery({
    queryKey: ['order-job-applications', user?.id],
    queryFn: async () => {
      const result = await orderAPI.getMyJobApplications();
      return result.applications || [];
    },
    enabled: isAuthenticated && dashboardQuery.data?.is_order_member === true,
    retry: 1,
  });

  // Fetch jobs for you (first 5 active jobs)
  const jobsQuery = useQuery({
    queryKey: ['order-jobs-for-you', user?.id],
    queryFn: async () => {
      const result = await orderAPI.listJobs({ active_only: true, limit: 5 });
      return result.jobs || [];
    },
    enabled: isAuthenticated && dashboardQuery.data?.is_order_member === true,
    retry: 1,
  });

  // Fetch lodge memberships
  const lodgeMembershipsQuery = useQuery({
    queryKey: ['order-lodge-memberships', user?.id],
    queryFn: () => orderAPI.getMyLodgeMemberships(),
    enabled: isAuthenticated && dashboardQuery.data?.is_order_member === true,
    retry: 1,
  });

  // Fetch current lodge details if user has a lodge
  const currentLodgeQuery = useQuery({
    queryKey: ['order-current-lodge', dashboardQuery.data?.lodge_id],
    queryFn: () => orderAPI.getLodge(dashboardQuery.data!.lodge_id!),
    enabled: isAuthenticated && !!dashboardQuery.data?.lodge_id,
    retry: 1,
  });

  const isLoading =
    dashboardQuery.isLoading ||
    (dashboardQuery.data?.is_order_member && (
      profileQuery.isLoading ||
      bookingRequestsQuery.isLoading ||
      jobApplicationsQuery.isLoading ||
      jobsQuery.isLoading
    ));

  const isError =
    dashboardQuery.isError ||
    profileQuery.isError ||
    bookingRequestsQuery.isError ||
    jobApplicationsQuery.isError;

  const refetch = () => {
    dashboardQuery.refetch();
    profileQuery.refetch();
    applicationQuery.refetch();
    bookingRequestsQuery.refetch();
    jobApplicationsQuery.refetch();
    jobsQuery.refetch();
    lodgeMembershipsQuery.refetch();
    currentLodgeQuery.refetch();
  };

  return {
    dashboard: dashboardQuery.data || null,
    profile: profileQuery.data || null,
    application: applicationQuery.data || null,
    bookingRequests: bookingRequestsQuery.data || [],
    jobApplications: jobApplicationsQuery.data || [],
    jobsForYou: jobsQuery.data || [],
    lodgeMemberships: lodgeMembershipsQuery.data || [],
    currentLodge: currentLodgeQuery.data || null,
    isLoading: !!isLoading,
    isError,
    error: dashboardQuery.error as Error | null,
    refetch,
  };
}
