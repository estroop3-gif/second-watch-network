import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/integrations/supabase/env";

type InvokeOptions = {
  method?: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function invokeEdge<T = any>(name: string, options: InvokeOptions = {}) {
  const { method = "POST", body, headers = {} } = options;
  const url = `${SUPABASE_URL}/functions/v1/${name}`;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : { Authorization: `Bearer ${SUPABASE_ANON_KEY}` }),
      ...headers,
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });

  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    // ignore non-JSON
  }

  if (!resp.ok) {
    const message = data?.error || data?.message || resp.statusText || "Unknown error";
    return { data: null as unknown as T, error: new Error(message), status: resp.status };
  }

  return { data: data as T, error: null, status: resp.status };
}