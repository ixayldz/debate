import jwt from 'jsonwebtoken';
import config from '../../config/index.js';
import { TokenPayload } from '../../types/global.js';

function toIdString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeTokenPayload(payload: unknown): TokenPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const userId = toIdString(raw.userId ?? raw.id ?? raw.sub);
  const username =
    typeof raw.username === 'string'
      ? raw.username
      : (typeof raw.name === 'string' ? raw.name : undefined);

  if (!userId) {
    return null;
  }

  return {
    userId,
    email: typeof raw.email === 'string' ? raw.email : '',
    username,
  };
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });
}

export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn as any,
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwt.secret);
  const payload = normalizeTokenPayload(decoded);

  if (!payload) {
    throw new jwt.JsonWebTokenError('Invalid access token payload');
  }

  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, config.jwt.refreshSecret);
  const payload = normalizeTokenPayload(decoded);

  if (!payload) {
    throw new jwt.JsonWebTokenError('Invalid refresh token payload');
  }

  return payload;
}

export function decodeToken(token: string): TokenPayload | null {
  return normalizeTokenPayload(jwt.decode(token));
}
