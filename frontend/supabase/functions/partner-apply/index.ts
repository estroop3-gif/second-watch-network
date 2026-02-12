import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  full_name: string;
  company_name: string;
  email: string;
  phone?: string;
  website_url?: string;
  message: string;
};

async function sendEmail(to: string, subject: string, content: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return { ok: false, error: "Missing RESEND_API_KEY" };

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Second Watch <noreply@theswn.com>",
      to: [to],
      subject,
      html: `<div style="font-family:Inter,system-ui,sans-serif">
        <h2>New Partner Application</h2>
        <pre>${content}</pre>
      </div>`,
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
    // Use anon client for auth context (reads user from the Authorization header if present)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
    });

    // Service role client for DB writes
    const supabase = createClient(supabaseUrl, serviceRole);

    let payload: Payload;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    const required = ["full_name", "company_name", "email", "message"] as const;
    for (const k of required) {
      const v = (payload as any)[k];
      if (v == null || (typeof v === "string" && v.trim() === "")) {
        return new Response(JSON.stringify({ error: `Missing field: ${k}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Current user (optional)
    const { data: authData } = await supabaseAuth.auth.getUser();
    const applicantUserId = authData?.user?.id ?? null;

    // Duplicate check (non-blocking)
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent, error: recentErr } = await supabase
      .from("partner_applications")
      .select("id, created_at")
      .gte("created_at", since)
      .eq("contact_email", payload.email)
      .limit(1);

    if (recentErr) {
      console.log("Recent check error:", recentErr.message);
    }

    const insertObj: any = {
      user_id: applicantUserId,
      full_name: payload.full_name,
      company_name: payload.company_name,
      phone: payload.phone || null,
      website_url: payload.website_url || null,
      status: "new",
      // legacy-compatible fields present in table
      brand_name: payload.company_name,
      contact_name: payload.full_name,
      contact_email: payload.email,
      website: payload.website_url || null,
      message: payload.message,
      // optional structured fields set to null
      primary_platforms: null,
      audience_size: null,
      content_focus: null,
      sample_links: null,
      location: null,
    };

    const { data: created, error: insertErr } = await supabase
      .from("partner_applications")
      .insert(insertObj)
      .select("id")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: insertErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort internal email
    const summary = JSON.stringify(
      { ...payload, user_id: applicantUserId, recent_application_exists: !!(recent && recent.length > 0) },
      null,
      2
    );
    try {
      await sendEmail("estroop3@gmail.com", "New Partner Application", summary);
    } catch (e) {
      console.log("Email error", e);
    }

    return new Response(JSON.stringify({ id: created.id, status: "new" }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("partner-apply unexpected error:", e?.message || e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});