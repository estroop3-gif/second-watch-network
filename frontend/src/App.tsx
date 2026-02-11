import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { performanceMetrics } from "@/lib/performanceMetrics";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import Originals from "./pages/Originals";
import SubmitContent from "./pages/SubmitContent";
import TermsOfSubmission from "./pages/TermsOfSubmission";
import Shop from "./pages/Shop";
import WatchNow from "./pages/WatchNow";
import DashboardFree from "./pages/DashboardFree";
import ScrollToTop from "./components/ScrollToTop";
import ServeItUp from "./pages/ServeItUp";
import CoastalTorque from "./pages/CoastalTorque";
import ServingForGreece from "./pages/ServingForGreece";
import FailureToThrive from "./pages/FailureToThrive";
import CuedUp from "./pages/CuedUp";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";
import ResetPassword from "./pages/ResetPassword";
import { AuthProvider } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { EnrichedProfileProvider } from "./context/EnrichedProfileContext";
import { SocketProvider } from "./context/SocketContext";
import { ThemeProvider } from "./context/ThemeContext";
import { DashboardSettingsProvider } from "./context/DashboardSettingsContext";
import { GearCartProvider } from "./context/GearCartContext";
import { SetHouseCartProvider } from "./context/SetHouseCartContext";
import Dashboard from "./pages/Dashboard";
import Account from "./pages/Account";
import ThemeEditorPage from "./pages/ThemeEditorPage";
import ConfirmEmail from "./pages/ConfirmEmail";
import AuthenticatedLayout from "./components/AuthenticatedLayout";
import PublicLayout from "./components/PublicLayout";
import TheBacklot from "./pages/TheBacklot";
import ThreadPage from "./pages/ThreadPage";
import FilmmakerSubmissions from "./pages/FilmmakerSubmissions";
import Messages from "./pages/Messages";
import Filmmakers from "./pages/Filmmakers";
import FilmmakerProfile from "./pages/FilmmakerProfile";
import MyProfile from "./pages/MyProfile";
import MySubmissions from "./pages/MySubmissions";
import Notifications from "./pages/Notifications";
import Connections from "./pages/Connections";
import MyApplications from "./pages/MyApplications";
import ApplicationsReceived from "./pages/ApplicationsReceived";
import OnboardingGate from "./components/OnboardingGate";
import FilmmakerOnboarding from "./pages/FilmmakerOnboarding";
import FilmmakerOnboardingSuccess from "./pages/FilmmakerOnboardingSuccess";
import PlatformStatusGate from "./components/PlatformStatusGate";
import PermissionRoute from "./components/PermissionRoute";
import SubscriptionsAndRolesPage from "./pages/SubscriptionsAndRolesPage";
import SubscriptionSettingsPage from "./pages/SubscriptionSettings";
import FilmmakerApplicationPage from "./pages/FilmmakerApplication";
import SubmissionDetail from "./pages/SubmissionDetail";
import NotificationSettings from "./pages/NotificationSettings";
import BillingReturn from "./pages/BillingReturn";
import Donations from "./pages/Donations";
import PartnerApply from "./pages/PartnerApply";
import OrderSettings from "./pages/OrderSettings";
import OrganizationsPage from "./pages/Organizations";

// Green Room Pages
import GreenRoom from "./pages/GreenRoom";
import GreenRoomCycle from "./pages/GreenRoomCycle";
import GreenRoomSubmit from "./pages/GreenRoomSubmit";

// Order Pages
import {
  OrderLanding,
  OrderApply,
  OrderDashboard,
  OrderDirectory,
  OrderMemberProfile,
  OrderJobs,
  OrderJobDetail,
  OrderLodges,
  OrderLodgeDetail,
  OrderCraftHouses,
  OrderCraftHouseDetail,
  OrderFellowships,
  OrderFellowshipDetail,
  OrderGovernance,
} from "./pages/order";

// Admin Pages
import AdminLayout from "./pages/admin/Layout";
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/Users";
import SubmissionManagement from "./pages/admin/Submissions";
import ApplicationsManagement from "./pages/admin/Applications";
import ForumManagement from "./pages/admin/ForumManagement";
import ContentManagement from "./pages/admin/ContentManagement";
import FilmmakerProfileManagement from "./pages/admin/FilmmakerProfiles";
import AvailabilityManagement from "./pages/admin/Availability";
import SiteSettings from "./pages/admin/SiteSettings";
import GreenRoomManagement from "./pages/admin/GreenRoomManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import BacklotOversight from "./pages/admin/BacklotOversight";
import BillingManagement from "./pages/admin/Billing";
import PartnerManagement from "./pages/admin/PartnerManagement";
import Moderation from "./pages/admin/Moderation";
import MessageModeration from "./pages/admin/MessageModeration";
import CommunityManagement from "./pages/admin/CommunityManagement";
import AuditLog from "./pages/admin/AuditLog";
import AdminDonations from "./pages/admin/Donations";
import AlphaTesting from "./pages/admin/AlphaTesting";
import EmailLogs from "./pages/admin/EmailLogs";
import AdminOrganizations from "./pages/admin/Organizations";

// Partner Pages
import PartnerLayout from "./pages/partner/Layout";
import PartnerDashboard from "./pages/partner/Dashboard";
import AdPlacements from "./pages/partner/AdPlacements";
import Analytics from "./pages/partner/Analytics";
import PartnerPromotions from "./pages/partner/Promotions";

// CRM Pages
import CRMLayout from "./pages/crm/Layout";
import CRMDashboard from "./pages/crm/CRMDashboard";
import CRMContacts from "./pages/crm/Contacts";
import CRMContactDetail from "./pages/crm/ContactDetail";
import CRMActivityCalendar from "./pages/crm/ActivityCalendar";
import CRMInteractionTracker from "./pages/crm/InteractionTracker";
import CRMTeamView from "./pages/crm/TeamView";
import CRMReports from "./pages/crm/Reports";
import CRMPipeline from "./pages/crm/Pipeline";
import CRMDealDetail from "./pages/crm/DealDetail";
import CRMLeads from "./pages/crm/Leads";
import CRMGoals from "./pages/crm/Goals";
import CRMKPIDashboard from "./pages/crm/KPIDashboard";
import CRMCustomerLog from "./pages/crm/CustomerLog";
import CRMRepReviews from "./pages/crm/RepReviews";
import CRMAdminReviews from "./pages/crm/AdminReviews";
import CRMCampaigns from "./pages/crm/Campaigns";
import CRMCampaignDetail from "./pages/crm/CampaignDetail";
import CRMDNCList from "./pages/crm/DNCList";
import CRMEmail from "./pages/crm/Email";
import CRMAdminLayout from "./pages/crm/AdminLayout";
import CRMAdminEmail from "./pages/crm/AdminEmail";
import CRMAdminBusinessCards from "./pages/crm/AdminBusinessCards";
import CRMTraining from "./pages/crm/Training";
import CRMDiscussions from "./pages/crm/Discussions";
import CRMBusinessCardForm from "./components/crm/BusinessCardForm";
import { EmailComposeProvider } from "./context/EmailComposeContext";

// Backlot Production Hub Pages
import { BacklotHome, ProjectWorkspace, PublicProjectPage, PublicCallSheetPage, CollabApplicantsPage, ApplicantDetailPage } from "./pages/backlot";
import React, { Suspense } from "react";

// Lazy load the external reviewer view since it's a public route
const ExternalReviewerView = React.lazy(() =>
  import("./components/backlot/review/external/ExternalReviewerView")
);

// Lazy load clearance view page for public document viewing/signing
const ClearanceViewPage = React.lazy(() =>
  import("./pages/ClearanceViewPage")
);

// Lazy load moodboard print page
const MoodboardPrintPage = React.lazy(() =>
  import("./pages/backlot/MoodboardPrintPage")
);

// Lazy load storyboard print page
const StoryboardPrintPage = React.lazy(() =>
  import("./pages/backlot/StoryboardPrintPage")
);

// Lazy load story print page
const StoryPrintPage = React.lazy(() =>
  import("./pages/backlot/StoryPrintPage")
);

// Lazy load sides print page
const SidesPrintPage = React.lazy(() =>
  import("./pages/backlot/SidesPrintPage")
);

// Lazy load stripboard print page
const StripboardPrintPage = React.lazy(() =>
  import("./pages/backlot/StripboardPrintPage")
);

// Lazy load deal memo signing page (public, no auth)
const DealMemoSignPage = React.lazy(() =>
  import("./pages/DealMemoSignPage")
);

// Lazy load onboarding wizard pages
const OnboardingWizardPage = React.lazy(() =>
  import("./pages/backlot/OnboardingWizardPage")
);
const ExternalOnboardingWizardPage = React.lazy(() =>
  import("./pages/backlot/OnboardingWizardPage").then(module => ({
    default: module.ExternalOnboardingWizardPage
  }))
);

// Church Production Tools Pages
import { ChurchToolsHome, ChurchToolPage } from "./pages/church";

// Gear House Pages
import GearHousePage from "./pages/gear/GearHousePage";
import GearWorkspacePage from "./pages/gear/GearWorkspacePage";
import IncidentDetailPage from "./pages/gear/IncidentDetailPage";
import UserStrikeDetailPage from "./pages/gear/UserStrikeDetailPage";
import { AsyncVerificationPage } from "./pages/gear/AsyncVerificationPage";
import MyGearLite from "./pages/MyGearLite";

// Set House Pages
import { SetHousePage, SetHouseWorkspacePage } from "./pages/set-house";

// Watch/Streaming Pages
import {
  WatchHome,
  WorldDetail,
  ShortsPlayer,
  EpisodePlayer,
  BrowsePage,
  SearchPage,
  LiveEventsPage,
  HistoryPage,
  VideoLibrary,
} from "./pages/watch";
import { StreamLayout } from "./components/watch";


const queryClient = new QueryClient();

// Performance metrics: mark app mounted
const AppMountTracker = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    performanceMetrics.markAppMounted();

    // Fallback: send initial load metrics after 5s if no API call triggers it
    const fallbackTimer = setTimeout(() => {
      performanceMetrics.sendInitialLoadMetricsFallback();
    }, 5000);

    return () => clearTimeout(fallbackTimer);
  }, []);

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
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
                  <Route path="/share/:shareToken" element={<PublicCallSheetPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/signin" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                </Route>

                {/* Public External Review Route (no auth required) */}
                <Route path="/review/:token" element={
                  <Suspense fallback={<div className="min-h-screen bg-charcoal-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" /></div>}>
                    <ExternalReviewerView />
                  </Suspense>
                } />

                {/* Public Clearance View/Sign Route (no auth required) */}
                <Route path="/clearance/view/:token" element={
                  <Suspense fallback={<div className="min-h-screen bg-charcoal-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" /></div>}>
                    <ClearanceViewPage />
                  </Suspense>
                } />

                {/* Public Deal Memo Signing Route (no auth required) */}
                <Route path="/deal-memo/sign/:token" element={
                  <Suspense fallback={<div className="min-h-screen bg-charcoal-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" /></div>}>
                    <DealMemoSignPage />
                  </Suspense>
                } />

                {/* Onboarding Wizard - Authenticated */}
                <Route path="/onboarding/:sessionId" element={
                  <Suspense fallback={<div className="min-h-screen bg-charcoal-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" /></div>}>
                    <OnboardingWizardPage />
                  </Suspense>
                } />

                {/* Onboarding Wizard - External/Token-based (no auth required) */}
                <Route path="/onboarding/external/:token" element={
                  <Suspense fallback={<div className="min-h-screen bg-charcoal-black flex items-center justify-center"><div className="animate-spin w-8 h-8 border-2 border-accent-yellow border-t-transparent rounded-full" /></div>}>
                    <ExternalOnboardingWizardPage />
                  </Suspense>
                } />

                {/* Auth pages without any layout */}
                <Route path="/confirm-email" element={<ConfirmEmail />} />
                <Route path="/filmmaker-onboarding" element={<FilmmakerOnboarding />} />
                <Route path="/filmmaker-onboarding/success" element={<FilmmakerOnboardingSuccess />} />
                <Route path="/apply/filmmaker" element={<FilmmakerApplicationPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/billing/return" element={<BillingReturn />} />

                {/* Watch/Streaming Routes with StreamLayout */}
                <Route path="/watch" element={<StreamLayout />}>
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
                    <Route element={<PermissionRoute requiredRoles={['filmmaker', 'admin', 'superadmin', 'moderator', 'partner', 'order_member', 'premium']} redirectTo="/my-gear" />}>
                      <Route path="/gear" element={<GearHousePage />} />
                      <Route path="/gear/:orgId" element={<GearWorkspacePage />} />
                      <Route path="/gear/:orgId/incidents/:incidentId" element={<IncidentDetailPage />} />
                      <Route path="/gear/:orgId/strikes/:userId" element={<UserStrikeDetailPage />} />
                    </Route>
                    {/* Public verification route - no auth required */}
                    <Route path="/gear/verify/:token" element={<AsyncVerificationPage />} />

                    {/* Set House Routes - restricted to non-free users */}
                    <Route element={<PermissionRoute requiredRoles={['filmmaker', 'admin', 'superadmin', 'moderator', 'partner', 'order_member', 'premium']} redirectTo="/dashboard" />}>
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
                    <Route element={<PermissionRoute requiredRoles={['filmmaker', 'admin']} />}>
                      <Route path="/submit-project" element={<FilmmakerSubmissions />} />
                      <Route path="/my-submissions" element={<MySubmissions />} />
                      <Route path="/submissions/:submissionId" element={<SubmissionDetail />} />
                    </Route>

                    {/* Partner Routes (also accessible by admin) */}
                    <Route path="/partner" element={<PermissionRoute requiredRoles={['partner', 'admin']} redirectTo="/dashboard" />}>
                      <Route element={<PartnerLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<PartnerDashboard />} />
                        <Route path="ad-placements" element={<AdPlacements />} />
                        <Route path="analytics" element={<Analytics />} />
                        <Route path="promotions" element={<PartnerPromotions />} />
                      </Route>
                    </Route>

                    {/* CRM Routes (sales agents and admin) */}
                    <Route path="/crm" element={<PermissionRoute requiredRoles={['sales_agent', 'sales_admin', 'admin', 'superadmin']} redirectTo="/dashboard" />}>
                      <Route element={<EmailComposeProvider><CRMLayout /></EmailComposeProvider>}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<CRMDashboard />} />
                        <Route path="contacts" element={<CRMContacts />} />
                        <Route path="contacts/:id" element={<CRMContactDetail />} />
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

                        {/* Admin sub-layout with horizontal tabs */}
                        <Route path="admin" element={<CRMAdminLayout />}>
                          <Route index element={<CRMKPIDashboard />} />
                          <Route path="team" element={<CRMTeamView />} />
                          <Route path="leads" element={<CRMLeads />} />
                          <Route path="campaigns" element={<CRMCampaigns />} />
                          <Route path="campaigns/:id" element={<CRMCampaignDetail />} />
                          <Route path="email" element={<CRMAdminEmail />} />
                          <Route path="business-cards" element={<CRMAdminBusinessCards />} />
                          <Route path="reviews" element={<CRMAdminReviews />} />
                          <Route path="dnc" element={<CRMDNCList />} />
                          <Route path="reports" element={<CRMReports />} />
                        </Route>

                        {/* Redirects from old admin routes */}
                        <Route path="kpi" element={<Navigate to="/crm/admin" replace />} />
                        <Route path="campaigns" element={<Navigate to="/crm/admin/campaigns" replace />} />
                        <Route path="campaigns/:id" element={<Navigate to="/crm/admin/campaigns" replace />} />
                        <Route path="templates" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="sequences" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="sequences/:id" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="email-analytics" element={<Navigate to="/crm/admin/email" replace />} />
                        <Route path="dnc" element={<Navigate to="/crm/admin/dnc" replace />} />
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
                        <Route path="billing" element={<BillingManagement />} />
                        <Route path="organizations" element={<AdminOrganizations />} />
                        <Route path="partners" element={<PartnerManagement />} />
                        <Route path="moderation" element={<Moderation />} />
                        <Route path="message-moderation" element={<MessageModeration />} />
                        <Route path="community" element={<CommunityManagement />} />
                        <Route path="audit-log" element={<AuditLog />} />
                        <Route path="donations" element={<AdminDonations />} />
                        <Route path="alpha-testing" element={<AlphaTesting />} />
                        <Route path="email-logs" element={<EmailLogs />} />
                        <Route path="settings" element={<SiteSettings />} />
                      </Route>
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
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
  </QueryClientProvider>
);

export default App;