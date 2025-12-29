import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@12.17.0?target=deno";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRole);

  const signature = req.headers.get("stripe-signature") || "";
  let event: Stripe.Event;

  try {
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err?.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400, headers: corsHeaders });
  }

  async function logActivity(userId: string, event_type: string, details: Record<string, unknown>) {
    await admin.from("subscription_activity").insert({
      user_id: userId,
      event_type,
      details,
    });
  }

  async function setPremiumOn(userId: string, customerId?: string, subscription?: Stripe.Subscription) {
    // profiles: role + billing_provider_id + optional end date snapshot
    const periodEnd = subscription?.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    await admin
      .from("profiles")
      .update({
        role: "premium",
        billing_provider_id: customerId ?? null,
        subscription_ends_at: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // auth metadata: role + roles[]
    const { data: existingUser } = await admin.auth.admin.getUserById(userId);
    const currentMeta = (existingUser?.user?.user_metadata ?? {}) as Record<string, unknown>;
    const currentRoles = Array.isArray(currentMeta.roles) ? (currentMeta.roles as string[]) : [];
    const newRoles = Array.from(new Set([...(currentRoles || []), "premium"]));
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...currentMeta,
        role: "premium",
        roles: newRoles,
      },
    });

    // Notify + activity log
    await admin.from("notifications").insert({
      user_id: userId,
      title: "Premium activated",
      body: "Your Premium membership is now active.",
      type: "subscription",
      related_id: null,
      status: "unread",
      payload: { customerId, subscriptionId: subscription?.id ?? null },
    });

    await logActivity(userId, "webhook_upgraded", {
      customerId,
      subscriptionId: subscription?.id ?? null,
      status: subscription?.status ?? null,
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = (session.client_reference_id || session.metadata?.user_id) as string | undefined;
        const customerId = (session.customer as string) || undefined;
        const subscriptionId = (session.subscription as string) || undefined;

        if (userId && customerId) {
          // Store Stripe customer id for mapping future subscription events
          await admin.from("profiles").update({ billing_provider_id: customerId }).eq("id", userId);
          await logActivity(userId, "checkout_completed", {
            customerId,
            subscriptionId: subscriptionId ?? null,
            mode: session.mode,
            status: session.status,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status;
        if (status === "active" || status === "trialing") {
          const customerId = sub.customer as string;

          // Map customer -> user profile
          const { data: profile } = await admin
            .from("profiles")
            .select("id")
            .eq("billing_provider_id", customerId)
            .maybeSingle();

          const userId = profile?.id as string | undefined;
          if (userId) {
            await setPremiumOn(userId, customerId, sub);
            await logActivity(userId, "subscription_active", {
              customerId,
              subscriptionId: sub.id,
              status,
              period_start: new Date(sub.current_period_start * 1000).toISOString(),
              period_end: new Date(sub.current_period_end * 1000).toISOString(),
            });
          }
        }
        break;
      }

      default:
        // Ignore others
        break;
    }

    return new Response(JSON.stringify({ received: true }), { headers: corsHeaders });
  } catch (e: any) {
    console.error("Webhook processing error", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "Server error" }), { status: 500, headers: corsHeaders });
  }
});