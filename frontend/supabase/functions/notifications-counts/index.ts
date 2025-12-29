import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });

  try {
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" }});
    }

    // Try counters row first
    const { data: counters } = await userClient
      .from("notifications_counters")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (counters) {
      return new Response(JSON.stringify({
        unread_total: counters.unread_total,
        unread_messages: counters.unread_messages,
        unread_requests: counters.unread_requests,
        unread_submissions: counters.unread_submissions,
        updated_at: counters.updated_at,
      }), { headers: { ...cors, "Content-Type": "application/json" }});
    }

    // Fallback: compute from notifications
    const { data: notes, error } = await userClient
      .from("notifications")
      .select("type, status")
      .eq("user_id", user.id);

    if (error) throw error;

    const out = { unread_total: 0, unread_messages: 0, unread_requests: 0, unread_submissions: 0, updated_at: new Date().toISOString() };
    for (const n of notes ?? []) {
      if (n.status !== "unread") continue;
      out.unread_total++;
      const t = (n.type || "").toLowerCase();
      if (t.startsWith("message")) out.unread_messages++;
      else if (t.startsWith("connection")) out.unread_requests++;
      else if (t.startsWith("submission")) out.unread_submissions++;
    }

    return new Response(JSON.stringify(out), { headers: { ...cors, "Content-Type": "application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" }});
  }
});