import { api } from "@/lib/api";

type InvokeOptions = {
  method?: "POST" | "GET" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Invoke an edge function via the FastAPI backend
 * Note: This is a compatibility layer - edge functions should be migrated to FastAPI endpoints
 */
export async function invokeEdge<T = any>(name: string, options: InvokeOptions = {}) {
  const { method = "POST", body, headers = {} } = options;
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const url = `${baseUrl}/api/v1/edge/${name}`;

  const accessToken = api.getToken();

  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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
    const message = data?.error || data?.message || data?.detail || resp.statusText || "Unknown error";
    return { data: null as unknown as T, error: new Error(message), status: resp.status };
  }

  return { data: data as T, error: null, status: resp.status };
}
