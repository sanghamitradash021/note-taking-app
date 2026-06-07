import { useAuthStore } from '../stores/authStore.js';

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAccessToken, clearAuth } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) {
      clearAuth();
      return null;
    }
    const data = (await res.json()) as { data: { accessToken: string } };
    setAccessToken(data.data.accessToken);
    return data.data.accessToken;
  } catch {
    clearAuth();
    return null;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

  let res = await fetch(path, { ...init, headers });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(path, { ...init, headers });
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: string };
    };
    throw new ApiError(
      body.error?.message ?? 'Request failed',
      body.error?.code ?? 'UNKNOWN',
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public status: number,
  ) {
    super(message);
  }
}
