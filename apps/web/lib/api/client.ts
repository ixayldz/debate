'use client';

import { API_BASE_URL } from './config';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { ApiErrorShape, AuthTokens } from './types';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorShape;

  constructor(message: string, status: number, payload?: ApiErrorShape) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

function makeRequestId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}`;
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return response.text();
  }
  return response.json();
}

export async function refreshAccessToken(): Promise<string | null> {
  const { clearSession, updateAccessToken } = useAuthStore.getState();
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: JSON_HEADERS,
      credentials: 'include',
    });

    if (!response.ok) {
      clearSession();
      return null;
    }

    const payload = (await response.json()) as Pick<AuthTokens, 'accessToken'>;
    updateAccessToken(payload.accessToken);
    return payload.accessToken;
  } catch {
    clearSession();
    return null;
  }
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { auth = false, headers, ...rest } = options;
  const { accessToken, clearSession } = useAuthStore.getState();
  const requestHeaders = new Headers(headers);

  requestHeaders.set('X-Request-Id', makeRequestId());
  if (auth && accessToken) {
    requestHeaders.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!requestHeaders.has('Content-Type') && rest.body) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const execute = (token?: string) => {
    const hdrs = new Headers(requestHeaders);
    if (auth && token) {
      hdrs.set('Authorization', `Bearer ${token}`);
    }
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: hdrs,
      credentials: 'include',
    });
  };

  let response = await execute(accessToken);
  if (auth && response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      response = await execute(newAccessToken);
    } else {
      clearSession();
    }
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const apiPayload = typeof payload === 'object' ? (payload as ApiErrorShape) : undefined;
    const message = apiPayload?.message || `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, apiPayload);
  }

  return payload as T;
}
