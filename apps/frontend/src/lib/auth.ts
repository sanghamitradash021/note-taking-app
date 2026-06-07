import type { ILoginResponse, IRegisterResponse } from '@noteapp/shared';
import { apiFetch } from './apiClient.js';

export async function register(email: string, password: string): Promise<IRegisterResponse> {
  const res = await apiFetch<{ data: IRegisterResponse }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.data;
}

export async function login(email: string, password: string): Promise<ILoginResponse> {
  const res = await apiFetch<{ data: ILoginResponse }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.data;
}

export async function logout(refreshToken: string): Promise<void> {
  await apiFetch('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
