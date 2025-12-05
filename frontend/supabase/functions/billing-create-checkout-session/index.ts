import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const PREMIUM_PRICE_ID = Deno.env.get("PREMIUM_PRICE_ID");
const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://secondwatch.network";

if (!STRIPE_SECRET_KEY) console.error("Missing STRIPE_SECRET_KEY");
if (!PREMIUM_PRICE_ID) console.error("Missing PREMIUM_PRICE_ID");

const stripe = new Stripe(STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { context, returnTo } = await req.json().catch(() => ({}));
    const safeReturnTo = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/dashboard";

    // Build URLs matching the app routes
    const successParams = new URLSearchParams({
      checkout: "success",
      returnTo: safeReturnTo,
    }).toString();
    const cancelParams = new URLSearchParams({
      checkout: "cancelled",
    }).toString();

    const successUrl = `${APP_BASE_URL}/account/billing?${successParams}`;
    const cancelUrl = `${APP_BASE_URL}/account/membership?${cancelParams}`;

    // Create a Checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PREMIUM_PRICE_ID!, quantity: 1 }],
      success_url: successUrl + "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        context: context || "",
        returnTo: safeReturnTo,
      },
      subscription_data: {
        metadata: {
          user_id: user.id,
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout-session error", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});