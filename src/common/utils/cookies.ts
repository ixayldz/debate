import type { CookieOptions, Request, Response } from 'express';
import config from '../../config/index.js';

function decodeComponentSafely(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readCookieValue(req: Request, name: string): string | null {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) {
    return null;
  }

  const parts = rawCookie.split(';');
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) {
      continue;
    }

    if (rawKey === name) {
      return decodeComponentSafely(rest.join('='));
    }
  }

  return null;
}

function getRefreshCookieOptions(): CookieOptions {
  const options: CookieOptions = {
    httpOnly: true,
    secure: config.auth.refreshCookieSecure,
    sameSite: config.auth.refreshCookieSameSite,
    maxAge: config.auth.refreshCookieMaxAgeMs,
    path: '/',
  };

  if (config.auth.refreshCookieDomain) {
    options.domain = config.auth.refreshCookieDomain;
  }

  return options;
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(config.auth.refreshCookieName, refreshToken, getRefreshCookieOptions());
}

export function clearRefreshTokenCookie(res: Response): void {
  const options = getRefreshCookieOptions();
  const clearOptions: CookieOptions = {
    path: options.path,
    domain: options.domain,
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
  };

  res.clearCookie(config.auth.refreshCookieName, clearOptions);
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  return readCookieValue(req, config.auth.refreshCookieName);
}

