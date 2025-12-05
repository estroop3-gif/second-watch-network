import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-http-method-override",
  "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
};

type Json = Record<string, unknown>;

// Accept camelCase payload keys (matches frontend form)
const profileSchema = z.object({
  fullName: z.string().min(2, "Full name is required.").optional(),
  displayName: z.string().optional(),
  location: z.string().optional(),
  location_visible: z.boolean().optional(),
  portfolio_website: z.string().url("Please enter a valid URL.").optional().or(z.literal("")),
  reel_links: z.array(z.string().url("Please enter a valid URL.").or(z.literal(""))).optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters.").optional(),
  department: z.string().optional(),
  skills: z.array(z.string()).optional(),
  experienceLevel: z.enum(["Entry-Level", "Mid-Level", "Senior", "Department Head"]).optional(),
  accepting_work: z.boolean().optional(),
  available_for: z.array(z.string()).optional(),
  preferred_locations: z.array(z.string()).optional(),
  contact_method: z.string().optional(),
  show_email: z.boolean().optional(),
});

type ProfilePayload = z.infer<typeof profileSchema>;

function toSnake(p: ProfilePayload) {
  return {
    full_name: p.fullName,
    display_name: p.displayName,
    location: p.location,
    location_visible: p.location_visible,
    portfolio_website: p.portfolio_website,
    reel_links: p.reel_links,
    bio: p.bio,
    department: p.department,
    skills: p.skills,
    experience_level: p.experienceLevel,
    accepting_work: p.accepting_work,
    available_for: p.available_for,
    preferred_locations: p.preferred_locations,
    contact_method: p.contact_method,
    show_email: p.show_email,
  };
}

function pickDefined<T extends Record<string, unknown>>(obj: T) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization")! } },
  });

  const adminClient = createClient(supabaseUrl, serviceKey);

  try {
    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData?.user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const authUser = userData.user;

    // Accept both true HTTP methods (POST/PUT) and an optional body intent override
    const body = await req.json().catch(() => ({} as any)) as {
      userId?: string;
      intent?: "create" | "update";
      payload?: ProfilePayload;
    };

    const httpMethod = req.method.toUpperCase();
    const intent = body.intent || (httpMethod === "PUT" ? "update" : "create");
    const targetUserId = body.userId || authUser.id;

    // Check admin override permission if acting on another user
    if (targetUserId !== authUser.id) {
      // Determine admin via DB function is_admin
      const { data: isAdmin } = await adminClient.rpc("is_admin", { user_id: authUser.id });
      if (!isAdmin) {
        return json({ error: "Forbidden: Only admins can edit other users' profiles." }, 403);
      }
    }

    const payload = (body.payload || {}) as ProfilePayload;

    // Validate input
    const parsed = profileSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        if (issue.path?.length) {
          fieldErrors[String(issue.path[0])] = issue.message;
        }
      }
      return json({ error: "Validation failed", fieldErrors }, 400);
    }

    const now = new Date().toISOString();
    const snake = toSnake(parsed.data);
    const cleanSnake = pickDefined(snake);

    const isAdminOverride = targetUserId !== authUser.id;
    const dbClient = isAdminOverride ? adminClient : userClient;

    // Ensure a single profile row exists in profiles (id = auth.users.id)
    if (intent === "create") {
      // Upsert minimal row
      const upsertCore: Record<string, unknown> = pickDefined({
        id: targetUserId,
        full_name: snake.full_name,
        display_name: snake.display_name,
        updated_at: now,
        // location_visible lives on profiles table in your schema
        location_visible: snake.location_visible,
      });

      const { error: upsertErr } = await dbClient
        .from("profiles")
        .upsert(upsertCore, { onConflict: "id" });

      if (upsertErr) {
        return json({ error: `Failed to create profile: ${upsertErr.message}` }, 500);
      }
    }

    // Apply updates to profiles (core)
    const coreUpdate: Record<string, unknown> = pickDefined({
      full_name: snake.full_name,
      display_name: snake.display_name,
      location_visible: snake.location_visible,
      updated_at: now,
    });

    if (Object.keys(coreUpdate).length > 0) {
      const { error: coreErr } = await dbClient
        .from("profiles")
        .update(coreUpdate)
        .eq("id", targetUserId);

      if (coreErr) {
        return json({ error: `Failed to update core profile: ${coreErr.message}` }, 500);
      }
    }

    // Apply updates to filmmaker_profiles (extended) via upsert on user_id
    const extendedUpdate: Record<string, unknown> = pickDefined({
      user_id: targetUserId,
      full_name: snake.full_name,
      bio: snake.bio,
      reel_links: snake.reel_links,
      portfolio_website: snake.portfolio_website,
      location: snake.location,
      department: snake.department,
      experience_level: snake.experience_level,
      skills: snake.skills,
      accepting_work: snake.accepting_work,
      available_for: snake.available_for,
      preferred_locations: snake.preferred_locations,
      contact_method: snake.contact_method,
      show_email: snake.show_email,
      updated_at: now,
    });

    if (Object.keys(extendedUpdate).length > 1) {
      const { error: extErr } = await dbClient
        .from("filmmaker_profiles")
        .upsert(extendedUpdate, { onConflict: "user_id" });

      if (extErr) {
        return json({ error: `Failed to update extended profile: ${extErr.message}` }, 500);
      }
    }

    // Return the merged/updated profile for convenience
    const { data: core } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", targetUserId)
      .maybeSingle();

    const { data: ext } = await adminClient
      .from("filmmaker_profiles")
      .select("*")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const result: Json = {
      id: core?.id ?? targetUserId,
      // Core
      username: core?.username ?? null,
      avatar_url: core?.avatar_url ?? null,
      role: core?.role ?? null,
      roles: core?.roles ?? null,
      full_name: core?.full_name ?? null,
      display_name: core?.display_name ?? null,
      location_visible: core?.location_visible ?? true,
      has_completed_filmmaker_onboarding: core?.has_completed_filmmaker_onboarding ?? false,
      updated_at: core?.updated_at ?? now,
      // Extended
      user_id: targetUserId,
      bio: ext?.bio ?? null,
      reel_links: ext?.reel_links ?? null,
      portfolio_website: ext?.portfolio_website ?? null,
      location: ext?.location ?? null,
      department: ext?.department ?? null,
      experience_level: ext?.experience_level ?? null,
      skills: ext?.skills ?? null,
      accepting_work: ext?.accepting_work ?? false,
      available_for: ext?.available_for ?? null,
      preferred_locations: ext?.preferred_locations ?? null,
      contact_method: ext?.contact_method ?? null,
      show_email: ext?.show_email ?? false,
      profile_image_url: ext?.profile_image_url ?? null,
    };

    return new Response(JSON.stringify({ profile: result, updated_at: result.updated_at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("Unhandled error in profile function:", e);
    return json({ error: "Internal server error" }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}