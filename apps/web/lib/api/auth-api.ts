'use client';

import { apiRequest } from './client';
import type { AuthTokens, AuthUser, Language } from './types';

interface AuthResponse extends Partial<AuthTokens> {
  user: AuthUser;
  isNewUser?: boolean;
}

export interface RegisterInput {
  username: string;
  displayName: string;
  email: string;
  password: string;
  language?: Language;
}

export interface LoginInput {
  email: string;
  password: string;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function requestPhoneOtp(phone: string): Promise<{ success: boolean; expiresIn: number; deliveryId?: string }> {
  return apiRequest('/auth/phone/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

export async function verifyPhoneOtp(input: {
  phone: string;
  code: string;
  username?: string;
  displayName?: string;
  language?: Language;
}): Promise<AuthResponse> {
  return apiRequest('/auth/phone/verify-otp', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<{ message: string }> {
  return apiRequest('/auth/logout', {
    method: 'POST',
    auth: true,
  });
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean }> {
  return apiRequest('/auth/password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, password: string): Promise<{ success: boolean }> {
  return apiRequest('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmail(token: string): Promise<{ success: boolean }> {
  return apiRequest('/auth/email/verify', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerificationEmail(): Promise<{ success: boolean }> {
  return apiRequest('/auth/email/resend', {
    method: 'POST',
    auth: true,
  });
}

export async function getOAuthUrl(provider: 'google' | 'twitter', state?: string): Promise<{ url: string; state: string }> {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  return apiRequest(`/auth/oauth/${provider}${query}`);
}

export async function exchangeOAuthCode(code: string): Promise<Pick<AuthTokens, 'accessToken'> & { userId: number }> {
  return apiRequest('/auth/exchange-code', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}
