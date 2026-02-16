const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const JWT_KEY = "og_jwt";

export function getJwt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(JWT_KEY);
}

export function setJwt(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(JWT_KEY, token);
}

export function clearJwt() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(JWT_KEY);
}

type RequestOptions = RequestInit & { withAuth?: boolean };

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.withAuth) {
    const token = getJwt();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}
