import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "noreply@theswn.com";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://secondwatch.network";

type Prefs = {
  user_id: string;
  email_digest_enabled: boolean;
  email_on_submission_updates: boolean;
  email_on_connection_accepts: boolean;
  digest_hour_utc: number;
};

type Note = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  related_id: string | null;
  created_at: string;
};

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) {
    console.error("Missing RESEND_API_KEY");
    return { ok: false, error: "Missing RESEND_API_KEY" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Second Watch Network <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("Resend error", err);
    return { ok: false, error: err };
  }
  return { ok: true };
}

function formatItem(n: Note): string {
  const t = (n.type || "").toLowerCase();
  let link = `${APP_BASE_URL}/notifications`;
  if (t.startsWith("submission")) {
    const sid = n.related_id;
    if (sid) link = `${APP_BASE_URL}/submissions/${sid}`;
  } else if (t.startsWith("connection.accept")) {
    // Safe fallback to Requests tab
    link = `${APP_BASE_URL}/notifications?tab=requests`;
  } else if (t.startsWith("message")) {
    // We do not email for chat messages
    return "";
  }
  const safeTitle = n.title || "Notification";
  const safeBody = n.body ? n.body : "";
  return `<li style="margin-bottom:10px;"><strong>${safeTitle}</strong><br/><span style="color:#666;">${safeBody}</span><br/><a href="${link}">Open</a></li>`;
}

function buildHtml(list: Note[]) {
  const items = list
    .map(formatItem)
    .filter(Boolean)
    .join("");
  if (!items) return "";
  return `
    <div>
      <h2>Your daily summary</h2>
      <p>Here are your unread updates. You can manage email preferences in Account → Notification Settings.</p>
      <ul style="padding-left:18px;">${items}</ul>
      <p style="margin-top:16px;color:#666;">You are receiving this email because daily digest is enabled.</p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });
  const serviceClient = createClient(supabaseUrl, service);

  try {
    const { preview } = await req.json().catch(() => ({ preview: false }));

    if (preview) {
      // Preview: current user only
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const { data: prefs } = await userClient
        .from("user_notification_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!prefs || !prefs.email_digest_enabled) {
        return new Response(JSON.stringify({ message: "Digest disabled" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      // Respect per-type preferences; exclude chat messages
      let query = userClient
        .from("notifications")
        .select("id,user_id,type,title,body,related_id,created_at")
        .eq("user_id", user.id)
        .eq("status", "unread")
        .lte("created_at", since);

      if (!prefs.email_on_submission_updates) {
        query = query.not("type", "ilike", "submission%");
      }
      if (!prefs.email_on_connection_accepts) {
        query = query.not("type", "ilike", "connection.accept%");
      }
      // Always exclude chat messages from email
      query = query.not("type", "ilike", "message%");

      const { data: notes } = await query;

      const html = buildHtml(notes ?? []);
      if (!html) {
        return new Response(JSON.stringify({ message: "No eligible notifications to email" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const to = user.email!;
      const subject = "Your daily summary";
      const result = await sendEmail(to, subject, html);
      if (!result.ok) {
        return new Response(JSON.stringify({ error: result.error }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Scheduled/all-users mode (requires service role)
    // Optional: only proceed if special header present
    // const isScheduled = req.headers.get("x-schedule") || req.headers.get("x-cron");
    // if (!isScheduled) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: prefsList } = await serviceClient
      .from("user_notification_settings")
      .select("*")
      .eq("email_digest_enabled", true);

    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    let sent = 0;
    for (const p of (prefsList ?? []) as Prefs[]) {
      // Fetch recipient email via Admin API
      const { data: ures } = await serviceClient.auth.admin.getUserById(p.user_id);
      const to = ures?.user?.email;
      if (!to) continue;

      let query = serviceClient
        .from("notifications")
        .select("id,user_id,type,title,body,related_id,created_at")
        .eq("user_id", p.user_id)
        .eq("status", "unread")
        .lte("created_at", since);

      if (!p.email_on_submission_updates) {
        query = query.not("type", "ilike", "submission%");
      }
      if (!p.email_on_connection_accepts) {
        query = query.not("type", "ilike", "connection.accept%");
      }
      query = query.not("type", "ilike", "message%");

      const { data: notes } = await query;
      const html = buildHtml(notes ?? []);
      if (!html) continue;

      const subject = "Your daily summary";
      const result = await sendEmail(to, subject, html);
      if (result.ok) sent++;
    }

    return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});