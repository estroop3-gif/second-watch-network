import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const schema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

async function sendEmail(to: string, displayName?: string) {
  const subject = "Welcome to Second Watch — profile created";
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;">
      <h2>Welcome${displayName ? `, ${displayName}` : ""}!</h2>
      <p>Your profile is set up. You can edit it anytime:</p>
      <p><a href="${Deno.env.get("SUPABASE_URL") || ""}/auth/v1/callback">Open the app</a> or go to <a href="${(Deno.env.get("SITE_URL") || "").replace(/\/$/, "")}/account">${(Deno.env.get("SITE_URL") || "").replace(/\/$/, "")}/account</a></p>
      <p>Thanks for joining Second Watch.</p>
    </div>
  `.trim();

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Second Watch <no-reply@secondwatch.app>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Resend API error: ${resp.status} ${text}`);
  }

  return { subject };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Validation failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { email, displayName } = parsed.data;

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { subject } = await sendEmail(email, displayName);

    await admin.from("emails").insert({
      to: email,
      subject,
      content: "Profile created email",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-profile-created-email error:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});