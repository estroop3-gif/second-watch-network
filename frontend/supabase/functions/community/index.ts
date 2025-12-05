import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SortBy = "updated_at" | "created_at";
type SortDir = "asc" | "desc";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    // Support both GET query params and POST body for flexibility
    const isGet = req.method === "GET";
    let q = url.searchParams.get("q") ?? "";
    let page = parseInt(url.searchParams.get("page") ?? "1", 10);
    let pageSize = parseInt(url.searchParams.get("pageSize") ?? "24", 10);
    let sortBy = (url.searchParams.get("sortBy") as SortBy) ?? "updated_at";
    let sortDir = (url.searchParams.get("sortDir") as SortDir) ?? "desc";
    const updatedSinceParam = url.searchParams.get("updatedSince");

    if (!isGet) {
      const body = await req.json().catch(() => ({}));
      q = body.q ?? q;
      page = body.page ?? page;
      pageSize = body.pageSize ?? pageSize;
      sortBy = (body.sortBy as SortBy) ?? sortBy;
      sortDir = (body.sortDir as SortDir) ?? sortDir;
    }

    if (!["updated_at", "created_at"].includes(sortBy)) sortBy = "updated_at";
    if (!["asc", "desc"].includes(sortDir)) sortDir = "desc";
    if (page < 1) page = 1;
    if (pageSize < 1 || pageSize > 100) pageSize = 24;

    const updatedSince = updatedSinceParam ? new Date(updatedSinceParam) : undefined;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Base query: only visible profiles
    let query = admin
      .from("community_profiles")
      .select("profile_id, username, full_name, display_name, avatar_url, updated_at, created_at", { count: "exact" })
      .eq("is_visible", true);

    // Search
    if (q && q.trim().length > 0) {
      const term = `%${q.trim()}%`;
      query = query.or(
        `username.ilike.${term},full_name.ilike.${term},display_name.ilike.${term}`
      );
    }

    // Incremental refresh
    if (updatedSince && !isNaN(updatedSince.getTime())) {
      query = query.gt("updated_at", updatedSince.toISOString());
    }

    // Sorting
    query = query.order(sortBy, { ascending: sortDir === "asc" }).order("profile_id", { ascending: sortDir === "asc" });

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("community query error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const items = data ?? [];
    const total = count ?? 0;

    const last = items[items.length - 1];
    const nextCursor = last
      ? { sortBy, sortDir, updated_at: last.updated_at, profile_id: last.profile_id }
      : null;

    return new Response(
      JSON.stringify({
        items,
        total,
        page,
        pageSize,
        nextCursor,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e) {
    console.error("community function error:", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});