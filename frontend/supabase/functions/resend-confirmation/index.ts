import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const schema = z.object({
  email: z.string().email("Invalid email."),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Validation failed" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const email = parsed.data.email.trim().toLowerCase();

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Rate limit: max 3 resends per hour per email, based on emails table logs
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent, error: logErr } = await admin
      .from("emails")
      .select("id, sent_at")
      .eq("to", email)
      .eq("subject", "Auth Confirmation Resend")
      .gte("sent_at", oneHourAgo);

    if (logErr) {
      console.error("Rate-limit log read error:", logErr);
    }
    const count = recent?.length ?? 0;
    if (count >= 3) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a bit." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Request resend from Supabase Auth
    const { error: resendErr } = await admin.auth.resend({
      type: "signup",
      email,
    });

    if (resendErr) {
      console.error("Resend error:", resendErr);
      const status = (resendErr as any)?.status ?? 400;
      return new Response(JSON.stringify({ error: resendErr.message ?? "Failed to resend confirmation" }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log the resend attempt
    await admin.from("emails").insert({
      to: email,
      subject: "Auth Confirmation Resend",
      content: "Resent confirmation email",
      status: "sent",
      sent_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Unhandled error in resend-confirmation:", e);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});