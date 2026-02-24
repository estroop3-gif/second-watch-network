import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { performanceMetrics } from "@/lib/performanceMetrics";
import { runCleanup } from "@/lib/formDraftStorage";
import React, { Suspense } from "react";

// --- Eager imports (critical render path) ---
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import ScrollToTop from "./components/ScrollToTop";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import NotificationSettings from "./pages/NotificationSettings";
import Connections from "./pages/Connections";
import BillingReturn from "./pages/BillingReturn";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { EnrichedProfileProvider } from "./context/EnrichedProfileContext";
import { SocketProvider } from "./context/SocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DashboardSettingsProvider } from "./context/DashboardSettingsContext";
import { GearCartProvider } from "./context/GearCartContext";
import { SetHouseCartProvider } from "./context/SetHouseCartContext";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import PublicLayout from "./components/PublicLayout";
import OnboardingGate from "./components/OnboardingGate";
import PlatformStatusGate from "./components/PlatformStatusGate";
import PermissionRoute from "./components/PermissionRoute";

// --- Lazy imports (code-split by feature area) ---

// Public pages
const Originals = React.lazy(() => import("./pages/Originals"));
const SubmitContent = React.lazy(() => import("./pages/SubmitContent"));
const TermsOfSubmission = React.lazy(() => import("./pages/TermsOfSubmission"));
const Shop = React.lazy(() => import("./pages/Shop"));
const WatchNow = React.lazy(() => import("./pages/WatchNow"));
const DashboardFree = React.lazy(() => import("./pages/DashboardFree"));
const ServeItUp = React.lazy(() => import("./pages/ServeItUp"));
const CoastalTorque = React.lazy(() => import("./pages/CoastalTorque"));
const ServingForGreece = React.lazy(() => import("./pages/ServingForGreece"));
const FailureToThrive = React.lazy(() => import("./pages/FailureToThrive"));
const CuedUp = React.lazy(() => import("./pages/CuedUp"));
const Terms = React.lazy(() => import("./pages/Terms"));
const Donations = React.lazy(() => import("./pages/Donations"));
const PartnerApply = React.lazy(() => import("./pages/PartnerApply"));
const SubscriptionsAndRolesPage = React.lazy(() => import("./pages/SubscriptionsAndRolesPage"));
const PricingPage = React.lazy(() => import("./pages/Pricing"));
const FilmmakerProfile = React.lazy(() => import("./pages/FilmmakerProfile"));

// Authenticated general pages
const ThemeEditorPage = React.lazy(() => import("./pages/ThemeEditorPage"));
const TheBacklot = React.lazy(() => import("./pages/TheBacklot"));
const ThreadPage = React.lazy(() => import("./pages/ThreadPage"));
const FilmmakerSubmissions = React.lazy(() => import("./pages/FilmmakerSubmissions"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Filmmakers = React.lazy(() => import("./pages/Filmmakers"));
const MyProfile = React.lazy(() => import("./pages/MyProfile"));
const MySubmissions = React.lazy(() => import("./pages/MySubmissions"));
const Notifications = React.lazy(() => import("./pages/Notifications"));
const MyApplications = React.lazy(() => import("./pages/MyApplications"));
const MyJobPosts = React.lazy(() => import("./pages/MyJobPosts"));
const ApplicationsReceived = React.lazy(() => import("./pages/ApplicationsReceived"));
const FilmmakerOnboarding = React.lazy(() => import("./pages/FilmmakerOnboarding"));
const FilmmakerOnboardingSuccess = React.lazy(() => import("./pages/FilmmakerOnboardingSuccess"));
const FilmmakerApplicationPage = React.lazy(() => import("./pages/FilmmakerApplication"));
const SubscriptionSettingsPage = React.lazy(() => import("./pages/SubscriptionSettings"));
const SubmissionDetail = React.lazy(() => import("./pages/SubmissionDetail"));
const OrderSettings = React.lazy(() => import("./pages/OrderSettings"));
const OrganizationsPage = React.lazy(() => import("./pages/Organizations"));

// Green Room Pages
const GreenRoom = React.lazy(() => import("./pages/GreenRoom"));
const GreenRoomCycle = React.lazy(() => import("./pages/GreenRoomCycle"));
const GreenRoomSubmit = React.lazy(() => import("./pages/GreenRoomSubmit"));

// Order Pages
const OrderLanding = React.lazy(() => import("./pages/order/OrderLanding"));
const OrderApply = React.lazy(() => import("./pages/order/OrderApply"));
const OrderDashboard = React.lazy(() => import("./pages/order/OrderDashboard"));
const OrderDirectory = React.lazy(() => import("./pages/order/OrderDirectory"));
const OrderMemberProfile = React.lazy(() => import("./pages/order/OrderMemberProfile"));
const OrderJobs = React.lazy(() => import("./pages/order/OrderJobs"));
const OrderJobDetail = React.lazy(() => import("./pages/order/OrderJobDetail"));
const OrderLodges = React.lazy(() => import("./pages/order/OrderLodges"));
const OrderLodgeDetail = React.lazy(() => import("./pages/order/OrderLodgeDetail"));
const OrderCraftHouses = React.lazy(() => import("./pages/order/OrderCraftHouses"));
const OrderCraftHouseDetail = React.lazy(() => import("./pages/order/OrderCraftHouseDetail"));
const OrderFellowships = React.lazy(() => import("./pages/order/OrderFellowships"));
const OrderFellowshipDetail = React.lazy(() => import("./pages/order/OrderFellowshipDetail"));
const OrderGovernance = React.lazy(() => import("./pages/order/OrderGovernance"));

// Admin Pages
const AdminLayout = React.lazy(() => import("./pages/admin/Layout"));
const AdminDashboard = React.lazy(() => import("./pages/admin/Dashboard"));
const UserManagement = React.lazy(() => import("./pages/admin/Users"));
const SubmissionManagement = React.lazy(() => import("./pages/admin/Submissions"));
const ApplicationsManagement = React.lazy(() => import("./pages/admin/Applications"));
const ForumManagement = React.lazy(() => import("./pages/admin/ForumManagement"));
const ContentManagement = React.lazy(() => import("./pages/admin/ContentManagement"));
const FilmmakerProfileManagement = React.lazy(() => import("./pages/admin/FilmmakerProfiles"));
const AvailabilityManagement = React.lazy(() => import("./pages/admin/Availability"));
const SiteSettings = React.lazy(() => import("./pages/admin/SiteSettings"));
const GreenRoomManagement = React.lazy(() => import("./pages/admin/GreenRoomManagement"));
const OrderManagement = React.lazy(() => import("./pages/admin/OrderManagement"));
const BacklotOversight = React.lazy(() => import("./pages/admin/BacklotOversight"));
const BillingManagement = React.lazy(() => import("./pages/admin/Billing"));
const PartnerManagement = React.lazy(() => import("./pages/admin/PartnerManagement"));
const Moderation = React.lazy(() => import("./pages/admin/Moderation"));
const MessageModeration = React.lazy(() => import("./pages/admin/MessageModeration"));
const CommunityManagement = React.lazy(() => import("./pages/admin/CommunityManagement"));
const AuditLog = React.lazy(() => import("./pages/admin/AuditLog"));
const AdminDonations = React.lazy(() => import("./pages/admin/Donations"));
const AlphaTesting = React.lazy(() => import("./pages/admin/AlphaTesting"));
const EmailLogs = React.lazy(() => import("./pages/admin/EmailLogs"));
const AdminEmailPage = React.lazy(() => import("./pages/admin/AdminEmail"));
const AdminOrganizations = React.lazy(() => import("./pages/admin/Organizations"));
const AdminBacklotTrials = React.lazy(() => import("./pages/admin/BacklotTrials"));

// Public Pages
const BacklotFreeTrial = React.lazy(() => import("./pages/BacklotFreeTrial"));

// Partner Pages
const PartnerLayout = React.lazy(() => import("./pages/partner/Layout"));
const PartnerDashboard = React.lazy(() => import("./pages/partner/Dashboard"));
const AdPlacements = React.lazy(() => import("./pages/partner/AdPlacements"));
const Analytics = React.lazy(() => import("./pages/partner/Analytics"));
const PartnerPromotions = React.lazy(() => import("./pages/partner/Promotions"));

// CRM Pages
const CRMLayout = React.lazy(() => import("./pages/crm/Layout"));
const CRMDashboard = React.lazy(() => import("./pages/crm/CRMDashboard"));
const CRMContacts = React.lazy(() => import("./pages/crm/Contacts"));
const CRMContactDetail = React.lazy(() => import("./pages/crm/ContactDetail"));
const CRMActivityCalendar = React.lazy(() => import("./pages/crm/ActivityCalendar"));
const CRMInteractionTracker = React.lazy(() => import("./pages/crm/InteractionTracker"));
const CRMTeamView = React.lazy(() => import("./pages/crm/TeamView"));
const CRMReports = React.lazy(() => import("./pages/crm/Reports"));
const CRMPipeline = React.lazy(() => import("./pages/crm/Pipeline"));
const CRMDealDetail = React.lazy(() => import("./pages/crm/DealDetail"));
const CRMLeads = React.lazy(() => import("./pages/crm/Leads"));
const CRMAdminLeads = React.lazy(() => import("./pages/crm/admin/AdminLeads"));
const CRMGoals = React.lazy(() => import("./pages/crm/Goals"));
const CRMKPIDashboard = React.lazy(() => import("./pages/crm/KPIDashboard"));
const CRMCustomerLog = React.lazy(() => import("./pages/crm/CustomerLog"));
const CRMRepReviews = React.lazy(() => import("./pages/crm/RepReviews"));
const CRMAdminReviews = React.lazy(() => import("./pages/crm/AdminReviews"));
const CRMCampaigns = React.lazy(() => import("./pages/crm/Campaigns"));
const CRMCampaignDetail = React.lazy(() => import("./pages/crm/CampaignDetail"));
const CRMDNCList = React.lazy(() => import("./pages/crm/DNCList"));
const CRMRepDNCList = React.lazy(() => import("./pages/crm/RepDNCList"));
const CRMEmail = React.lazy(() => import("./pages/crm/Email"));
const CRMAdminLayout = React.lazy(() => import("./pages/crm/AdminLayout"));
const CRMAdminEmail = React.lazy(() => import("./pages/crm/AdminEmail"));
const CRMAdminBusinessCards = React.lazy(() => import("./pages/crm/AdminBusinessCards"));
const CRMRepDetail = React.lazy(() => import("./pages/crm/admin/RepDetail"));
const CRMAdminScraping = React.lazy(() => import("./pages/crm/AdminScraping"));
const CRMCompanyDetail = React.lazy(() => import("./pages/crm/CompanyDetail"));
const CRMPricingTab = React.lazy(() => import("./pages/crm/PricingTab"));
const CRMTraining = React.lazy(() => import("./pages/crm/Training"));
const CRMDiscussions = React.lazy(() => import("./pages/crm/Discussions"));
const CRMBusinessCardForm = React.lazy(() => import("./components/crm/BusinessCardForm"));
const EmailComposeProvider = React.lazy(() =>
  import("./context/EmailComposeContext").then(m => ({ default: m.EmailComposeProvider }))
);

// Media Hub Pages
const MediaLayout = React.lazy(() => import("./pages/media/Layout"));
const MediaDashboard = React.lazy(() => import("./pages/media/Dashboard"));
const MediaContentRequests = React.lazy(() => import("./pages/media/ContentRequests"));
const MediaNewRequest = React.lazy(() => import("./pages/media/NewRequest"));
const MediaRequestDetail = React.lazy(() => import("./pages/media/RequestDetail"));
const MediaCalendar = React.lazy(() => import("./pages/media/Calendar"));
const MediaPlatforms = React.lazy(() => import("./pages/media/Platforms"));
const MediaEmail = React.lazy(() => import("./pages/media/Email"));
const MediaEvents = React.lazy(() => import("./pages/media/Events"));
const MediaNewEvent = React.lazy(() => import("./pages/media/NewEvent"));
const MediaEventDetail = React.lazy(() => import("./pages/media/EventDetail"));
const MediaDiscussions = React.lazy(() => import("./pages/media/Discussions"));
const MediaDiscussionThread = React.lazy(() => import("./pages/media/DiscussionThread"));
const MediaAnalytics = React.lazy(() => import("./pages/media/Analytics"));
const MediaAdmin = React.lazy(() => import("./pages/media/Admin"));

// The Slate - Production database (IMDB-style)
const SlateIndex = React.lazy(() => import("./pages/SlateIndex"));
const SlatePage = React.lazy(() => import("./pages/SlatePage"));

// Backlot Production Hub Pages
const BacklotHome = React.lazy(() => import("./pages/backlot/BacklotHome"));
const ProjectWorkspace = React.lazy(() => import("./pages/backlot/ProjectWorkspace"));
const PublicProjectPage = React.lazy(() => import("./pages/backlot/PublicProjectPage"));
const PublicCallSheetPage = React.lazy(() => import("./pages/backlot/PublicCallSheetPage"));
const CollabApplicantsPage = React.lazy(() => import("./pages/backlot/CollabApplicantsPage"));
const ApplicantDetailPage = React.lazy(() => import("./pages/backlot/ApplicantDetailPage"));
const ExternalReviewerView = React.lazy(() =>
  import("./components/backlot/review/external/ExternalReviewerView")
);
const ClearanceViewPage = React.lazy(() => import("./pages/ClearanceViewPage"));
const MoodboardPrintPage = React.lazy(() => import("./pages/backlot/MoodboardPrintPage"));
const StoryboardPrintPage = React.lazy(() => import("./pages/backlot/StoryboardPrintPage"));
const StoryPrintPage = React.lazy(() => import("./pages/backlot/StoryPrintPage"));
const SidesPrintPage = React.lazy(() => import("./pages/backlot/SidesPrintPage"));
const StripboardPrintPage = React.lazy(() => import("./pages/backlot/StripboardPrintPage"));
const DealMemoSignPage = React.lazy(() => import("./pages/DealMemoSignPage"));
const OnboardingWizardPage = React.lazy(() => import("./pages/backlot/OnboardingWizardPage"));
const ExternalOnboardingWizardPage = React.lazy(() =>
  import("./pages/backlot/OnboardingWizardPage").then(module => ({
    default: module.ExternalOnboardingWizardPage
  }))
);

// Church Production Tools Pages
const ChurchToolsHome = React.lazy(() => import("./pages/church/ChurchToolsHome"));
const ChurchToolPage = React.lazy(() => import("./pages/church/ChurchToolPage"));

// Gear House Pages
const GearHousePage = React.lazy(() => import("./pages/gear/GearHousePage"));
const GearWorkspacePage = React.lazy(() => import("./pages/gear/GearWorkspacePage"));
const IncidentDetailPage = React.lazy(() => import("./pages/gear/IncidentDetailPage"));
const UserStrikeDetailPage = React.lazy(() => import("./pages/gear/UserStrikeDetailPage"));
const AsyncVerificationPage = React.lazy(() =>
  import("./pages/gear/AsyncVerificationPage").then(m => ({ default: m.AsyncVerificationPage }))
);
const MyGearLite = React.lazy(() => import("./pages/MyGearLite"));

// Set House Pages
const SetHousePage = React.lazy(() => import("./pages/set-house/SetHousePage"));
const SetHouseWorkspacePage = React.lazy(() => import("./pages/set-house/SetHouseWorkspacePage"));

// Watch/Streaming Pages
const WatchHome = React.lazy(() => import("./pages/watch/WatchHome"));
const WorldDetail = React.lazy(() => import("./pages/watch/WorldDetail"));
const ShortsPlayer = React.lazy(() => import("./pages/watch/ShortsPlayer"));
const EpisodePlayer = React.lazy(() => import("./pages/watch/EpisodePlayer"));
const BrowsePage = React.lazy(() => import("./pages/watch/BrowsePage"));
const SearchPage = React.lazy(() => import("./pages/watch/SearchPage"));
const LiveEventsPage = React.lazy(() => import("./pages/watch/LiveEventsPage"));
const HistoryPage = React.lazy(() => import("./pages/watch/HistoryPage"));
const VideoLibrary = React.lazy(() => import("./pages/watch/VideoLibrary"));
const StreamLayout = React.lazy(() => import("./components/watch/StreamLayout"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min — data stays fresh, no unnecessary refetches
      gcTime: 24 * 60 * 60 * 1000,     // 24h — keep in cache so localStorage restore works
      refetchOnWindowFocus: false,       // Stop refetch storm on every tab switch
      retry: 1,                          // Retry once instead of 3 times
    },
  },
});

// Persist query cache to localStorage — tabs load instantly from cache,
// then refetch in the background when staleTime (5 min) has passed
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'swn-query-cache',
  throttleTime: 2000,                   // Batch writes to localStorage
});

// Suspense fallback for lazy-loaded routes
const LoadingSpinner = () => (
  <div className="min-h-screen bg-charcoal-black flex items-center justify-center">
    <div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" />
  </div>
);

// Performance metrics: mark app mounted
const AppMountTracker = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    performanceMetrics.markAppMounted();
    runCleanup();

    // Fallback: send initial load metrics after 5s if no API call triggers it
    const fallbackTimer = setTimeout(() => {
      performanceMetrics.sendInitialLoadMetricsFallback();
    }, 5000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  return <>{children}</>;
};

const App = () => (
  <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}>
    <AppMountTracker>
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <EnrichedProfileProvider>
            <DashboardSettingsProvider>
              <SocketProvider>
                <GearCartProvider>
                <SetHouseCartProvider>
                <PlatformStatusGate>
                  <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <ScrollToTop />
              <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route path="/" element={<Index />} />

                {/* Public Routes with LandingHeader */}
                <Route element={<PublicLayout />}>
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/donations" element={<Donations />} />
                  <Route path="/originals" element={<Originals />} />
                  <Route path="/submit" element={<SubmitContent />} />
                  <Route path="/terms-of-submission" element={<TermsOfSubmission />} />
                  <Route path="/partners/apply" element={<PartnerApply />} />
                  <Route path="/subscriptions" element={<SubscriptionsAndRolesPage />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/account/membership" element={<SubscriptionsAndRolesPage />} />
                  <Route path="/watch-now" element={<WatchNow />} />
                  <Route path="/dashboard/free" element={<DashboardFree />} />
                  <Route path="/serve-it-up" element={<ServeItUp />} />
                  <Route path="/coastal-torque" element={<CoastalTorque />} />
                  <Route path="/serving-for-greece" element={<ServingForGreece />} />
                  <Route path="/failure-to-thrive" element={<FailureToThrive />} />
                  <Route path="/cued-up" element={<CuedUp />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/profile/:username" element={<FilmmakerProfile />} />
                  <Route path="/projects/:slug" element={<PublicProjectPage />} />
                  <Route path="/slate" element={<SlateIndex />} />
                  <Route path="/slate/:slug" element={<SlatePage />} />
                  <Route path="/share/:shareToken" element={<PublicCallSheetPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signin" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/backlot/free-trial" element={<BacklotFreeTrial />} />
                </Route>

                {/* Public External Review Route (no auth required) */}
                <Route path="/review/:token" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <ExternalReviewerView />
                  </Suspense>
                } />

                {/* Public Clearance View/Sign Route (no auth required) */}
                <Route path="/clearance/view/:token" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <ClearanceViewPage />
                  </Suspense>
                } />

                {/* Public Deal Memo Signing Route (no auth required) */}
                <Route path="/deal-memo/sign/:token" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <DealMemoSignPage />
                  </Suspense>
                } />

                {/* Onboarding Wizard - Authenticated */}
                <Route path="/onboarding/:sessionId" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <OnboardingWizardPage />
                  </Suspense>
                } />

                {/* Onboarding Wizard - External/Token-based (no auth required) */}
                <Route path="/onboarding/external/:token" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <ExternalOnboardingWizardPage />
                  </Suspense>
                } />

                {/* Auth pages without any layout */}
                <Route path="/confirm-email" element={<ConfirmEmail />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/filmmaker-onboarding" element={<FilmmakerOnboarding />} />
                <Route path="/filmmaker-onboarding/success" element={<FilmmakerOnboardingSuccess />} />
                <Route path="/apply/filmmaker" element={<FilmmakerApplicationPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/billing/return" element={<BillingReturn />} />

                {/* Watch/Streaming Routes with StreamLayout */}
                <Route path="/watch" element={
                  <Suspense fallback={<LoadingSpinner />}>
                    <StreamLayout />
                  </Suspense>
                }>
                  <Route index element={<WatchHome />} />
                  <Route path="worlds/:slug" element={<WorldDetail />} />
                  <Route path="browse" element={<BrowsePage />} />
                  <Route path="search" element={<SearchPage />} />
                  <Route path="events" element={<LiveEventsPage />} />
                  <Route path="history" element={<HistoryPage />} />
                  <Route path="library" element={<VideoLibrary />} />
                </Route>

                {/* Immersive Watch Routes (no layout) */}
                <Route path="/watch/episode/:episodeId" element={<EpisodePlayer />} />
                <Route path="/watch/shorts" element={<ShortsPlayer />} />

                {/* Authenticated Routes with AppHeader */}
                <Route element={<OnboardingGate />}>
                  <Route element={<AuthenticatedLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/account/notification-settings" element={<NotificationSettings />} />
                    <Route path="/account/order-settings" element={<OrderSettings />} />
                    <Route path="/account/billing" element={<SubscriptionSettingsPage />} />
                    {/* keep legacy path working */}
                    <Route path="/account/subscription-settings" element={<SubscriptionSettingsPage />} />
                    <Route path="/account/themes" element={<ThemeEditorPage />} />
                    <Route path="/organizations" element={<OrganizationsPage />} />
                    <Route path="/notifications" element={<Notifications />} />
                    <Route path="/connections" element={<Connections />} />
                    <Route path="/my-applications" element={<MyApplications />} />
                    <Route path="/my-job-posts" element={<MyJobPosts />} />
                    <Route path="/applications-received" element={<ApplicationsReceived />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/my-profile" element={<MyProfile />} />
                    <Route path="/filmmakers" element={<Filmmakers />} />
                    <Route path="/the-backlot" element={<TheBacklot />} />
                    <Route path="/the-backlot/threads/:threadId" element={<ThreadPage />} />

                    {/* Backlot Production Hub Routes */}
                    <Route path="/backlot" element={<BacklotHome />} />
                    <Route path="/backlot/projects/:projectId" element={<ProjectWorkspace />} />
                    <Route path="/backlot/projects/:projectId/postings/:collabId/applicants" element={<CollabApplicantsPage />} />
                    <Route path="/backlot/projects/:projectId/postings/:collabId/applicants/:applicationId" element={<ApplicantDetailPage />} />
                    <Route path="/backlot/:projectId/moodboards/:moodboardId/print" element={
                      <Suspense fallback={<div className="min-h-screen bg-white p-8">Loading...</div>}>
                        <MoodboardPrintPage />
                      </Suspense>
                    } />
                    <Route path="/backlot/:projectId/storyboards/:storyboardId/print" element={
                      <Suspense fallback={<div className="min-h-screen bg-white p-8">Loading...</div>}>
                        <StoryboardPrintPage />
                      </Suspense>
                    } />
                    <Route path="/backlot/:projectId/stories/:storyId/print" element={
                      <Suspense fallback={<div className="min-h-screen bg-white p-8">Loading...</div>}>
                        <StoryPrintPage />
                      </Suspense>
                    } />
                    <Route path="/backlot/:projectId/sides/:packetId/print" element={
                      <Suspense fallback={<div className="min-h-screen bg-white p-8">Loading...</div>}>
                        <SidesPrintPage />
                      </Suspense>
                    } />
                    <Route path="/backlot/:projectId/stripboard/:stripboardId/print" element={
                      <Suspense fallback={<div className="min-h-screen bg-white p-8">Loading...</div>}>
                        <StripboardPrintPage />
                      </Suspense>
                    } />

                    {/* Church Production Tools Routes */}
                    <Route path="/church" element={<ChurchToolsHome />} />
                    <Route path="/church/:tool" element={<ChurchToolPage />} />

                    {/* Gear House Routes - restricted to non-free users */}
                    <Route element={<PermissionRoute requiredRoles={['filmmaker', 'admin', 'superadmin', 'moderator', 'partner', 'order_member', 'premium', 'sales_rep']} redirectTo="/my-gear" />}>
                      <Route path="/gear" element={<GearHousePage />} />
                      <Route path="/gear/:orgId" element={<GearWorkspacePage />} />
                      <Route path="/gear/:orgId/incidents/:incidentId" element={<IncidentDetailPage />} />
                      <Route path="/gear/:orgId/strikes/:userId" element={<UserStrikeDetailPage />} />
                    </Route>
                    {/* Public verification route - no auth required */}
                    <Route path="/gear/verify/:token" element={<AsyncVerificationPage />} />

                    {/* Set House Routes - restricted to non-free users */}
                    <Route element={<PermissionRoute requiredRoles={['filmmaker', 'admin', 'superadmin', 'moderator', 'partner', 'order_member', 'premium', 'sales_rep']} redirectTo="/dashboard" />}>
                      <Route path="/set-house" element={<SetHousePage />} />
                      <Route path="/set-house/:orgId" element={<SetHouseWorkspacePage />} />
                    </Route>

                    {/* My Gear (Lite) - accessible to all authenticated users */}
                    <Route path="/my-gear" element={<MyGearLite />} />

                    {/* Green Room Routes */}
                    <Route path="/greenroom" element={<GreenRoom />} />
                    <Route path="/greenroom/cycles/:id" element={<GreenRoomCycle />} />
                    <Route path="/greenroom/submit" element={<GreenRoomSubmit />} />

                    {/* Order Routes */}
                    <Route path="/order" element={<OrderLanding />} />
                    <Route path="/order/apply" element={<OrderApply />} />
                    <Route path="/order/dashboard" element={<OrderDashboard />} />
                    <Route path="/order/directory" element={<OrderDirectory />} />
                    <Route path="/order/members/:userId" element={<OrderMemberProfile />} />
                    <Route path="/order/jobs" element={<OrderJobs />} />
                    <Route path="/order/jobs/:jobId" element={<OrderJobDetail />} />
                    <Route path="/order/lodges" element={<OrderLodges />} />
                    <Route path="/order/lodges/:lodgeId" element={<OrderLodgeDetail />} />
                    <Route path="/order/craft-houses" element={<OrderCraftHouses />} />
                    <Route path="/order/craft-houses/:slug" element={<OrderCraftHouseDetail />} />
                    <Route path="/order/fellowships" element={<OrderFellowships />} />
                    <Route path="/order/fellowships/:slug" element={<OrderFellowshipDetail />} />
                    <Route path="/order/governance" element={<OrderGovernance />} />

                    {/* Filmmaker-only Routes (also accessible by admin) */}
                    <Route element={<PermissionRoute requiredRoles={['filmmaker', 'admin', 'sales_rep']} />}>
                      <Route path="/submit-project" element={<FilmmakerSubmissions />} />
                      <Route path="/my-submissions" element={<MySubmissions />} />
                      <Route path="/submissions/:submissionId" element={<SubmissionDetail />} />
                    </Route>

                    {/* Partner Routes (also accessible by admin) */}
                    <Route path="/partner" element={<PermissionRoute requiredRoles={['partner', 'admin', 'sales_rep']} redirectTo="/dashboard" />}>
                      <Route element={<PartnerLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<PartnerDashboard />} />
                        <Route path="ad-placements" element={<AdPlacements />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="promotions" element={<PartnerPromotions />} />
                      </Route>
                    </Route>

                    {/* Media Hub Routes — accessible to ALL authenticated users */}
                    <Route path="/media" element={<EmailComposeProvider><MediaLayout /></EmailComposeProvider>}>
                      <Route index element={<Navigate to="requests" replace />} />
                      <Route path="requests" element={<MediaContentRequests />} />
                      <Route path="requests/new" element={<MediaNewRequest />} />
                      <Route path="requests/:id" element={<MediaRequestDetail />} />
                      <Route path="dashboard" element={<MediaDashboard />} />
                      <Route path="calendar" element={<MediaCalendar />} />
                      <Route path="platforms" element={<MediaPlatforms />} />
                      <Route path="email" element={<MediaEmail />} />
                      <Route path="events" element={<MediaEvents />} />
                      <Route path="events/new" element={<MediaNewEvent />} />
                      <Route path="events/:id" element={<MediaEventDetail />} />
                      <Route path="discussions" element={<MediaDiscussions />} />
                      <Route path="discussions/:threadId" element={<MediaDiscussionThread />} />
                      <Route path="analytics" element={<MediaAnalytics />} />
                      <Route path="admin" element={<MediaAdmin />} />
                    </Route>

                    {/* CRM Routes (sales agents and admin) */}
                    <Route path="/crm" element={<PermissionRoute requiredRoles={['sales_agent', 'sales_rep', 'sales_admin', 'admin', 'superadmin']} redirectTo="/dashboard" />}>
                      <Route element={<EmailComposeProvider><CRMLayout /></EmailComposeProvider>}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<CRMDashboard />} />
                        <Route path="contacts" element={<CRMContacts />} />
                        <Route path="contacts/:id" element={<CRMContactDetail />} />
                        <Route path="companies/:id" element={<CRMCompanyDetail />} />
                        <Route path="email" element={<CRMEmail />} />
                        <Route path="calendar" element={<CRMActivityCalendar />} />
                        <Route path="interactions" element={<CRMInteractionTracker />} />
                        <Route path="pipeline" element={<CRMPipeline />} />
                        <Route path="deals/:id" element={<CRMDealDetail />} />
                        <Route path="goals" element={<CRMGoals />} />
                        <Route path="log" element={<CRMCustomerLog />} />
                        <Route path="reviews" element={<CRMRepReviews />} />
                        <Route path="training" element={<CRMTraining />} />
                        <Route path="discussions" element={<CRMDiscussions />} />
                        <Route path="business-card" element={<CRMBusinessCardForm />} />
                        <Route path="pricing" element={<CRMPricingTab />} />

                        {/* Admin sub-layout with horizontal tabs */}
                        <Route path="admin" element={<CRMAdminLayout />}>
                          <Route index element={<CRMKPIDashboard />} />
                          <Route path="team" element={<CRMTeamView />} />
                          <Route path="team/:repId" element={<CRMRepDetail />} />
                          <Route path="leads" element={<CRMAdminLeads />} />
                          <Route path="campaigns" element={<CRMCampaigns />} />
                          <Route path="campaigns/:id" element={<CRMCampaignDetail />} />
                          <Route path="email" element={<CRMAdminEmail />} />
                          <Route path="business-cards" element={<CRMAdminBusinessCards />} />
                          <Route path="reviews" element={<CRMAdminReviews />} />
                          <Route path="dnc" element={<CRMDNCList />} />
                          <Route path="reports" element={<CRMReports />} />
                          <Route path="scraping" element={<CRMAdminScraping />} />
                        </Route>

                        {/* Redirects from old admin routes */}
                        <Route path="kpi" element={<Navigate to="/crm/admin" replace />} />
                        <Route path="campaigns" element={<Navigate to="/crm/admin/campaigns" replace />} />
                        <Route path="campaigns/:id" element={<Navigate to="/crm/admin/campaigns" replace />} />
                        <Route path="templates" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="sequences" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="sequences/:id" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="email-analytics" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="dnc" element={<CRMRepDNCList />} />
                        <Route path="team" element={<Navigate to="/crm/admin/team" replace />} />
                        <Route path="reports" element={<Navigate to="/crm/admin/reports" replace />} />
                        <Route path="leads" element={<Navigate to="/crm/admin/leads" replace />} />
                      </Route>
                    </Route>

                    {/* Admin Routes */}
                    <Route path="/admin" element={<PermissionRoute requiredRoles={['admin']} />}>
                      <Route element={<AdminLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="users" element={<UserManagement />} />
                                                <Route path="submissions" element={<SubmissionManagement />} />
                        <Route path="applications" element={<ApplicationsManagement />} />
                        <Route path="forum" element={<ForumManagement />} />
                        <Route path="content" element={<ContentManagement />} />
                        <Route path="greenroom" element={<GreenRoomManagement />} />
                        <Route path="profiles" element={<FilmmakerProfileManagement />} />
                        <Route path="availability" element={<AvailabilityManagement />} />
                        <Route path="order" element={<OrderManagement />} />
                        <Route path="backlot" element={<BacklotOversight />} />
                        <Route path="backlot-trials" element={<AdminBacklotTrials />} />
                        <Route path="billing" element={<BillingManagement />} />
                        <Route path="organizations" element={<AdminOrganizations />} />
                        <Route path="partners" element={<PartnerManagement />} />
                        <Route path="moderation" element={<Moderation />} />
                        <Route path="message-moderation" element={<MessageModeration />} />
                        <Route path="community" element={<CommunityManagement />} />
                        <Route path="audit-log" element={<AuditLog />} />
                        <Route path="donations" element={<AdminDonations />} />
                        <Route path="alpha-testing" element={<AlphaTesting />} />
                        <Route path="email" element={<AdminEmailPage />} />
                        <Route path="email-logs" element={<Navigate to="/admin/email" replace />} />
                        <Route path="settings" element={<SiteSettings />} />
                      </Route>
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
                  </TooltipProvider>
                </PlatformStatusGate>
                </SetHouseCartProvider>
                </GearCartProvider>
              </SocketProvider>
            </DashboardSettingsProvider>
          </EnrichedProfileProvider>
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
    </AppMountTracker>
  </PersistQueryClientProvider>
);

export default App;
