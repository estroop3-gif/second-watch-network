import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type UpdatePayload = {
  id: string;
  status?: "new" | "under_review" | "approved" | "rejected";
  admin_notes?: string | null;
};

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return { ok: false, error: "Missing RESEND_API_KEY" };
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Second Watch <noreply@secondwatch.network>",
      to: [to],
      subject,
      html,
    }),
  });
  const data = await resp.json();
  return { ok: resp.ok, data };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRole, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    });

    const { data: auth } = await supabase.auth.getUser();
    const adminId = auth?.user?.id || null;
    if (!adminId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdminData } = await supabase.rpc("is_admin", { user_id: adminId });
    if (!isAdminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body: UpdatePayload = await req.json();
    if (!body.id) {
      return new Response(JSON.stringify({ error: "Missing application id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const update: any = {};
    if (typeof body.admin_notes !== "undefined") update.admin_notes = body.admin_notes;
    if (typeof body.status !== "undefined") update.status = body.status;

    if (Object.keys(update).length === 0) {
      return new Response(JSON.stringify({ error: "No fields to update" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: updated, error: updErr } = await supabase
      .from("partner_applications")
      .update(update)
      .eq("id", body.id)
      .select("*")
      .single();

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (body.status && updated?.contact_email) {
      const templates: Record<string, { subject: string; body: string }> = {
        approved: {
          subject: "Your Partner Application has been approved!",
          body: `<p>Hi ${updated.full_name || "there"},</p><p>Great news — your application to partner with Second Watch Network has been approved. We’ll reach out soon with next steps.</p>`,
        },
        rejected: {
          subject: "Update on your Partner Application",
          body: `<p>Hi ${updated.full_name || "there"},</p><p>Thanks for applying to partner with Second Watch Network. We’re unable to move forward at this time, but we appreciate your interest.</p>`,
        },
        under_review: {
          subject: "Your Partner Application is under review",
          body: `<p>Hi ${updated.full_name || "there"},</p><p>We received your application<think>Deciding which files are relevant...

[
  "supabase/functions/partner-apply/index.ts",
  "supabase/functions/partner-applications-list/index.ts",
  "supabase/functions/partner-application-status/index.ts"
]</think><think>Ranked files:

src/components/admin/ViewPartnerApplicationModal.tsx: 0.97

supabase/functions/partner-application-status/index.ts: 0.95

supabase/functions/partner-apply/index.ts: 0.95

src/components/admin/PartnerApplicationsTab.tsx: 0.95

src/types/index.ts: 0.91

src/pages/PartnerApply.tsx: 0.90

supabase/functions/partner-applications-list/index.ts: 0.85

src/components/forms/PartnershipForm.tsx: 0.83

src/integrations/supabase/client.ts: 0.82

src/App.tsx: 0.71

src/components/ui/dialog.tsx: 0.64

src/components/admin/ViewApplicationModal.tsx: 0.64

src/components/ui/textarea.tsx: 0.62

src/components/ui/form.tsx: 0.61

src/components/forms/FilmmakerApplicationForm.tsx: 0.60

src/components/ui/input.tsx: 0.60

src/components/ui/sonner.tsx: 0.58

src/pages/admin/Applications.tsx: 0.57

src/components/ui/label.tsx: 0.51

src/hooks/use-toast.ts: 0.51

src/pages/admin/Dashboard.tsx: 0.48

src/components/ui/toaster.tsx: 0.47

src/components/ui/use-toast.ts: 0.45

supabase/functions/update-submission-status/index.ts: 0.45

src/pages/admin/Layout.tsx: 0.43

src/context/AuthContext.tsx: 0.42

src/components/forms/SubmissionForm.tsx: 0.41

supabase/functions/get-filmmaker-profile/index.ts: 0.37

src/pages/SubmitContent.tsx: 0.36

src/components/ui/button.tsx: 0.35

src/components/landing/LandingHeader.tsx: 0.35

src/pages/FilmmakerApplication.tsx: 0.33

src/components/ui/toast.tsx: 0.32

src/utils/toast.ts: 0.31

src/components/admin/FilmmakerApplicationsTab.tsx: 0.31

src/pages/SubmissionDetail.tsx: 0.31

src/hooks/useCommunityRealtime.ts: 0.31

src/pages/Index.tsx: 0.30

src/components/ui/table.tsx: 0.30

src/pages/partner/Layout.tsx: 0.30

src/pages/LandingPage.tsx: 0.30

supabase/functions/send-submission-email/index.ts: 0.28

src/pages/partner/Dashboard.tsx: 0.27

src/components/AuthenticatedLayout.tsx: 0.27

src/pages/admin/Submissions.tsx: 0.26

src/hooks/useProfile.tsx: 0.26

src/components/modals/EditSubmissionModal.tsx: 0.24

src/components/ui/badge.tsx: 0.24

src/components/admin/SubmissionDetailsModal.tsx: 0.23

src/components/admin/AdminNotificationsFeed.tsx: 0.23

supabase/functions/profile/index.ts: 0.22

src/components/ui/alert.tsx: 0.20

src/components/forms/SignupForm.tsx: 0.20

src/components/landing/PartnershipsSection.tsx: 0.19

src/components/ui/alert-dialog.tsx: 0.19

src/context/SettingsContext.tsx: 0.19

src/components/PlatformStatusGate.tsx: 0.19

src/pages/FilmmakerSubmissions.tsx: 0.18

supabase/functions/update-user-roles/index.ts: 0.18

src/components/profile/ProfileStatusUpdates.tsx: 0.18

src/pages/SubscriptionSettings.tsx: 0.17

src/pages/ConfirmEmail.tsx: 0.17

src/hooks/useNotifications.tsx: 0.17

src/components/admin/SubmissionNotesModal.tsx: 0.16

src/components/UserNav.tsx: 0.16

supabase/functions/notifications-read/index.ts: 0.16

src/components/ui/card.tsx: 0.16

src/components/ui/skeleton.tsx: 0.16

src/components/ui/select.tsx: 0.16

src/components/PublicLayout.tsx: 0.15

src/pages/partner/Promotions.tsx: 0.15

src/pages/partner/AdPlacements.tsx: 0.15

src/components/landing/SubmitContentSection.tsx: 0.15

src/hooks/useCommunity.ts: 0.14

src/hooks/usePermissions.ts: 0.14

src/pages/MySubmissions.tsx: 0.14

src/lib/utils.ts: 0.14

src/pages/Dashboard.tsx: 0.13

src/lib/permissions.ts: 0.13

src/components/OnboardingGate.tsx: 0.13

src/components/ui/scroll-area.tsx: 0.13

src/pages/admin/SiteSettings.tsx: 0.13

src/components/ui/multi-select.tsx: 0.13

supabase/functions/get-all-users/index.ts: 0.13

src/pages/admin/FilmmakerProfiles.tsx: 0.13

src/components/shared/SubmissionMessaging.tsx: 0.12

src/pages/NotificationSettings.tsx: 0.12

src/pages/admin/ContentManagement.tsx: 0.12

src/pages/Account.tsx: 0.12

src/components/forms/LoginForm.tsx: 0.12

src/components/ui/sheet.tsx: 0.12

src/globals.css: 0.12

supabase/functions/resend-confirmation/index.ts: 0.12

vite.config.ts: 0.12

src/components/modals/ConfirmationDialog.tsx: 0.12

src/main.tsx: 0.12

src/components/ui/tag-input.tsx: 0.11

src/data/content.ts: 0.11

src/pages/partner/Analytics.tsx: 0.11

src/pages/WatchNow.tsx: 0.11

src/components/ui/popover.tsx: 0.11

supabase/functions/send-profile-created-email/index.ts: 0.11

src/pages/AuthCallback.tsx: 0.11

src/components/dashboard/DashboardSection.tsx: 0.11

src/data/filmmaker-options.ts: 0.11

src/pages/DashboardFree.tsx: 0.11

src/pages/SubscriptionsAndRolesPage.tsx: 0.10

src/pages/admin/Availability.tsx: 0.10

src/components/admin/EditRolesDialog.tsx: 0.10

src/pages/Login.tsx: 0.10

src/pages/Notifications.tsx: 0.10

src/components/AppHeader.tsx: 0.10

src/pages/FilmmakerProfile.tsx: 0.09

src/components/subscriptions/SubscriptionActivityLog.tsx: 0.09

src/pages/Signup.tsx: 0.09

src/utils/telemetry.ts: 0.09

src/pages/Shop.tsx: 0.09

AI_RULES.md: 0.09

src/pages/FilmmakerOnboarding.tsx: 0.09

src/components/ui/dropdown-menu.tsx: 0.09

src/pages/ResetPassword.tsx: 0.09

index.html: 0.09

src/components/PermissionRoute.tsx: 0.09

src/pages/Messages.tsx: 0.09

src/components/UserNavMenuItems.tsx: 0.09

src/components/forms/FilmmakerOnboardingForm.tsx: 0.08

src/pages/ServeItUp.tsx: 0.08

supabase/functions/delete-user/index.ts: 0.08

src/components/ScrollToTop.tsx: 0.08

src/pages/BillingReturn.tsx: 0.08

src/pages/admin/ForumManagement.tsx: 0.08

src/components/ui/drawer.tsx: 0.08</think><dyad-codebase-context files="supabase/functions/partner-apply/index.ts,supabase/functions/partner-applications-list/index.ts,supabase/functions/partner-application-status/index.ts,src/components/admin/ViewPartnerApplicationModal.tsx,src/components/admin/PartnerApplicationsTab.tsx,src/types/index.ts,src/pages/PartnerApply.tsx,src/components/forms/PartnershipForm.tsx,src/integrations/supabase/client.ts"></dyad-codebase-context><think>dyad-token-savings?original-tokens=238843&smart-context-tokens=12201.75</think>You're right — we need to make this bulletproof. The most common cause of “Edge Function returned a non-2xx status code” is a mismatch in how the client calls the function versus how the function expects to be called. To eliminate that entire class of issues, I’ve done two things:

- Hardened the edge function (already done earlier) so it uses the right columns, proper CORS, and clearer errors.
- Switched the frontend to call edge functions via the full, hardcoded Function URL with both apikey and Authorization headers, ensuring the request is always routed correctly and carries user context when available.

Changes I’m making now:
- Add a small invokeEdge helper that calls functions using the hardcoded URL, with headers apikey and Authorization set correctly.
- Use that helper in both partner application forms (landing section form and dedicated PartnerApply page).
- Ensure admin list/status actions also work with the same reliable invocation method.

I’m keeping the payload the same; we’re just making the function invocation unambiguous and robust.

<dyad-write path="src/integrations/supabase/env.ts" description="Expose Supabase URL and anon key for reliable function calls.">
export const SUPABASE_URL = "https://twjlkyaocvgfkbwbefja.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3amxreWFvY3ZnZmtid2JlZmphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ0MzY5MzgsImV4cCI6MjA3MDAxMjkzOH0.Mt2gOl6zsNx_3Dt9GuvEmjZ8mHK1EVgy8Bgbpa3sbRA";