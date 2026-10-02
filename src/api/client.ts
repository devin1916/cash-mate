/**
 * CashMate API client.
 * - Access token kept in memory; refresh token lives in an httpOnly cookie.
 * - Transparently refreshes an expired session once, then retries.
 * - Emits `auth:expired` when the session is gone -> AuthContext logs out.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- generic transport layer; concrete entity types are applied by callers */
import type { User } from '../types';

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

let accessToken: string | null = null;
let refreshPromise: Promise<{ user: User; accessToken: string } | null> | null = null;

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fields = fields;
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

function emitExpired(): void {
  accessToken = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }
}

/** POST /auth/refresh - restores a session from the httpOnly cookie. */
export async function refreshSession(): Promise<{ user: User; accessToken: string } | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.data?.accessToken) return null;
        accessToken = body.data.accessToken;
        return body.data as { user: User; accessToken: string };
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
}

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, auth = true } = options;

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!formData) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include',
      headers,
      body: formData ? formData : body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  // Expired access token -> try one silent refresh, then retry once.
  // Never do this for the login/register endpoints themselves: a 401 there
  // means bad credentials, and the real server message must reach the form.
  const isCredentialEndpoint = path.startsWith('/auth/login') || path.startsWith('/auth/register');
  if (res.status === 401 && auth && !isCredentialEndpoint) {
    const renewed = await refreshSession();
    if (renewed) {
      res = await doFetch();
    } else {
      emitExpired();
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      payload?.message ||
      (res.status === 429
        ? 'Too many requests, please wait a moment and try again'
        : 'Something went wrong, please try again');
    throw new ApiError(message, res.status, payload?.errors);
  }

  return payload as T;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  meta?: any;
}

export const api = {
  get: <T = any>(path: string, params?: Record<string, any>) => {
    let url = path;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') qs.append(k, String(v));
      }
      const q = qs.toString();
      if (q) url += `?${q}`;
    }
    return request<ApiResponse<T>>(url, { method: 'GET' });
  },
  post: <T = any>(path: string, body?: unknown) => request<ApiResponse<T>>(path, { method: 'POST', body }),
  put: <T = any>(path: string, body?: unknown) => request<ApiResponse<T>>(path, { method: 'PUT', body }),
  patch: <T = any>(path: string, body?: unknown) => request<ApiResponse<T>>(path, { method: 'PATCH', body }),
  delete: <T = any>(path: string) => request<ApiResponse<T>>(path, { method: 'DELETE' }),
  upload: <T = any>(path: string, formData: FormData) =>
    request<ApiResponse<T>>(path, { method: 'POST', formData }),
};

export default api;
