import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

type Tab = "all" | "messages" | "requests" | "submissions";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...cors, "Content-Type": "application/json" }});
  }

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

    const body = await req.json().catch(() => ({}));
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;
    const tab: Tab | undefined = body?.tab;

    let query = userClient
      .from("notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("status", "unread");

    if (ids && ids.length > 0) {
      query = query.in("id", ids);
    } else if (tab && tab !== "all") {
      if (tab === "messages") query = query.ilike("type", "message%");
      if (tab === "requests") query = query.ilike("type", "connection%");
      if (tab === "submissions") query = query.ilike("type", "submission%");
    }

    const { error: updErr } = await query;
    if (updErr) throw updErr;

    // Return latest counters
    const { data: counters, error: cntErr } = await userClient
      .from("notifications_counters")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cntErr) throw cntErr;

    return new Response(JSON.stringify({
      unread_total: counters?.unread_total ?? 0,
      unread_messages: counters?.unread_messages ?? 0,
      unread_requests: counters?.unread_requests ?? 0,
      unread_submissions: counters?.unread_submissions ?? 0,
      updated_at: counters?.updated_at ?? new Date().toISOString()
    }), { headers: { ...cors, "Content-Type": "application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" }});
  }
});