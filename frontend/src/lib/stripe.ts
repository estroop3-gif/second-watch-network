/**
 * Shared Stripe initialization.
 * Loads the publishable key from VITE_STRIPE_PUBLISHABLE_KEY env var,
 * falling back to fetching it from the backend /billing/config endpoint.
 */
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { api } from '@/lib/api';

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (stripePromise) return stripePromise;

  const envKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (envKey) {
    stripePromise = loadStripe(envKey);
    return stripePromise;
  }

  // Fetch from backend
  stripePromise = api
    .get('/api/v1/billing/config')
    .then((config: any) => {
      const key = config?.publishable_key;
      if (!key) return null;
      return loadStripe(key);
    })
    .catch(() => null);

  return stripePromise;
}
