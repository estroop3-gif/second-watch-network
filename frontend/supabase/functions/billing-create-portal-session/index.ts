import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") || "";
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://secondwatch.network";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Ensure user is authenticated
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Parse optional returnTo
  const { returnTo } = await req.json().catch(() => ({}));
  const safeReturnTo =
    typeof returnTo === "string" && returnTo.startsWith("/")
      ? returnTo
      : "/account/billing";

  // Find Stripe customer id from profile
  const { data: profile, error: profileError } = await userClient
    .from("profiles")
    .select("billing_provider_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return new Response(JSON.stringify({ error: profileError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const customerId = profile?.billing_provider_id as string | undefined;
  if (!customerId) {
    return new Response(JSON.stringify({ error: "No Stripe customer on file. Please start a subscription first." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Create a billing portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_BASE_URL}${safeReturnTo}`,
  });

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});