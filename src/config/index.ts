import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === null || value.trim() === '') {
    return defaultValue;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function isLikelyPlaceholder(value: string): boolean {
  return /your-|your_|change|placeholder|example|dummy|test/i.test(value.trim());
}

function isWeakSecret(secret: string): boolean {
  if (secret.length < 32) {
    return true;
  }

  const weakPatterns = [
    /your-super-secret/i,
    /your-refresh-secret/i,
    /change-in-production/i,
    /default-secret/i,
    /not-for-production/i,
    /^dev[-_]/i,
  ];

  return weakPatterns.some(pattern => pattern.test(secret));
}

interface Config {
  nodeEnv: string;
  port: number;
  database: {
    url: string;
    directUrl?: string;
    ssl: boolean;
    poolMax: number;
    idleTimeoutMs: number;
    connectionTimeoutMs: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    tls: boolean;
    keyPrefix: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  oauth: {
    google: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
    twitter: {
      clientId: string;
      clientSecret: string;
      callbackUrl: string;
    };
  };
  livekit: {
    url: string;
    apiKey: string;
    apiSecret: string;
  };
  email: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  sms: {
    accountSid: string;
    authToken: string;
    from: string;
  };
  app: {
    frontendUrl: string;
    apiUrl: string;
    trustProxy: boolean | number | string;
  };
  auth: {
    refreshCookieName: string;
    refreshCookieDomain?: string;
    refreshCookieSecure: boolean;
    refreshCookieSameSite: 'lax' | 'strict' | 'none';
    refreshCookieMaxAgeMs: number;
  };
  room: {
    defaultGracePeriodSeconds: number;
    maxSpeakersDefault: number;
    micRequestCooldownSeconds: number;
    inviteExpirySeconds: number;
  };
  health: {
    strictExternals: boolean;
    externalCheckCacheTtlMs: number;
  };
  ops: {
    enablePublicMetrics: boolean;
    enableSwagger: boolean;
    internalKey: string;
  };
  migrations: {
    requireUpToDate: boolean;
  };
  services: {
    livekitRequired: boolean;
    emailRequired: boolean;
    smsRequired: boolean;
    externalCheckTimeoutMs: number;
  };
}

function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === null || value.trim() === '') {
    return 1;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  return value.trim();
}

function parseSameSite(value: string | undefined): 'lax' | 'strict' | 'none' {
  const normalized = (value || '').trim().toLowerCase();
  if (normalized === 'strict' || normalized === 'none' || normalized === 'lax') {
    return normalized;
  }

  return 'lax';
}

function validateRequired(): void {
  const missing: string[] = [];
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';
  const isTest = nodeEnv === 'test';

  const databaseUrl = isTest && process.env.TEST_DATABASE_URL
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;
  const redisHost = isTest && process.env.TEST_REDIS_HOST
    ? process.env.TEST_REDIS_HOST
    : process.env.REDIS_HOST;
  const jwtSecret = process.env.JWT_SECRET || '';
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || '';
  const refreshCookieSecure = isProd
    ? true
    : parseBoolean(process.env.REFRESH_COOKIE_SECURE, false);
  const refreshCookieSameSite = parseSameSite(process.env.REFRESH_COOKIE_SAMESITE);

  if (!databaseUrl) missing.push(isTest ? 'TEST_DATABASE_URL or DATABASE_URL' : 'DATABASE_URL');
  if (!redisHost) missing.push(isTest ? 'TEST_REDIS_HOST or REDIS_HOST' : 'REDIS_HOST');
  if (!jwtSecret) {
    missing.push('JWT_SECRET');
  }
  if (!jwtRefreshSecret) {
    missing.push('JWT_REFRESH_SECRET');
  }

  if (isProd) {
    if (isWeakSecret(jwtSecret)) {
      missing.push('JWT_SECRET (must be strong and production-safe)');
    }
    if (isWeakSecret(jwtRefreshSecret)) {
      missing.push('JWT_REFRESH_SECRET (must be strong and production-safe)');
    }
  }

  const livekitRequired = isProd ? true : parseBoolean(process.env.LIVEKIT_REQUIRED, false);
  if (livekitRequired) {
    if (!process.env.LIVEKIT_URL) missing.push('LIVEKIT_URL');
    if (!process.env.LIVEKIT_API_KEY) missing.push('LIVEKIT_API_KEY');
    if (!process.env.LIVEKIT_API_SECRET) missing.push('LIVEKIT_API_SECRET');
    if (process.env.LIVEKIT_URL && isLikelyPlaceholder(process.env.LIVEKIT_URL)) {
      missing.push('LIVEKIT_URL (must not be a placeholder)');
    }
    if (process.env.LIVEKIT_API_KEY && isLikelyPlaceholder(process.env.LIVEKIT_API_KEY)) {
      missing.push('LIVEKIT_API_KEY (must not be a placeholder)');
    }
    if (process.env.LIVEKIT_API_SECRET && isLikelyPlaceholder(process.env.LIVEKIT_API_SECRET)) {
      missing.push('LIVEKIT_API_SECRET (must not be a placeholder)');
    }
  }

  const emailRequired = isProd
    ? parseBoolean(process.env.EMAIL_REQUIRED, true)
    : parseBoolean(process.env.EMAIL_REQUIRED, false);
  if (emailRequired) {
    if (!process.env.EMAIL_HOST) missing.push('EMAIL_HOST');
    if (!process.env.EMAIL_USER) missing.push('EMAIL_USER');
    if (!process.env.EMAIL_PASSWORD) missing.push('EMAIL_PASSWORD');
    if (process.env.EMAIL_HOST && isLikelyPlaceholder(process.env.EMAIL_HOST)) {
      missing.push('EMAIL_HOST (must not be a placeholder)');
    }
    if (process.env.EMAIL_USER && isLikelyPlaceholder(process.env.EMAIL_USER)) {
      missing.push('EMAIL_USER (must not be a placeholder)');
    }
    if (process.env.EMAIL_PASSWORD && isLikelyPlaceholder(process.env.EMAIL_PASSWORD)) {
      missing.push('EMAIL_PASSWORD (must not be a placeholder)');
    }
  }

  const smsRequired = isProd
    ? parseBoolean(process.env.SMS_REQUIRED, false)
    : parseBoolean(process.env.SMS_REQUIRED, false);
  if (smsRequired) {
    if (!process.env.TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
    if (!process.env.TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
    if (!process.env.TWILIO_FROM) missing.push('TWILIO_FROM');
    if (process.env.TWILIO_ACCOUNT_SID && isLikelyPlaceholder(process.env.TWILIO_ACCOUNT_SID)) {
      missing.push('TWILIO_ACCOUNT_SID (must not be a placeholder)');
    }
    if (process.env.TWILIO_AUTH_TOKEN && isLikelyPlaceholder(process.env.TWILIO_AUTH_TOKEN)) {
      missing.push('TWILIO_AUTH_TOKEN (must not be a placeholder)');
    }
    if (process.env.TWILIO_FROM && isLikelyPlaceholder(process.env.TWILIO_FROM)) {
      missing.push('TWILIO_FROM (must not be a placeholder)');
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (refreshCookieSameSite === 'none' && !refreshCookieSecure) {
    throw new Error('REFRESH_COOKIE_SAMESITE=none requires REFRESH_COOKIE_SECURE=true');
  }
}

validateRequired();

export const config: Config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  database: {
    url:
      (process.env.NODE_ENV === 'test' && process.env.TEST_DATABASE_URL)
        ? process.env.TEST_DATABASE_URL
        : (process.env.DATABASE_URL || ''),
    directUrl: process.env.DIRECT_URL,
    ssl: parseBoolean(process.env.DATABASE_SSL, false),
    poolMax: parseNumber(process.env.DATABASE_POOL_MAX, 20),
    idleTimeoutMs: parseNumber(process.env.DATABASE_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMs: parseNumber(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 10000),
  },

  redis: {
    host:
      (process.env.NODE_ENV === 'test' && process.env.TEST_REDIS_HOST)
        ? process.env.TEST_REDIS_HOST
        : (process.env.REDIS_HOST || 'localhost'),
    port:
      (process.env.NODE_ENV === 'test' && process.env.TEST_REDIS_PORT)
        ? parseInt(process.env.TEST_REDIS_PORT, 10)
        : parseInt(process.env.REDIS_PORT || '6379', 10),
    password:
      (process.env.NODE_ENV === 'test' && process.env.TEST_REDIS_PASSWORD && process.env.TEST_REDIS_PASSWORD.trim() !== '')
        ? process.env.TEST_REDIS_PASSWORD
        : process.env.REDIS_PASSWORD,
    tls: parseBoolean(process.env.REDIS_TLS, false),
    keyPrefix:
      process.env.REDIS_KEY_PREFIX?.trim() ||
      ((process.env.NODE_ENV === 'test' ? process.env.TEST_REDIS_PREFIX : '') || '').trim(),
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-me',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/oauth/google/callback',
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      callbackUrl: process.env.TWITTER_CALLBACK_URL || 'http://localhost:3000/auth/oauth/twitter/callback',
    },
  },

  livekit: {
    url: process.env.LIVEKIT_URL || '',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
  },

  email: {
    host: process.env.EMAIL_HOST || '',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || 'noreply@debate.com',
  },

  sms: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    from: process.env.TWILIO_FROM || '',
  },

  app: {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  },

  auth: {
    refreshCookieName: process.env.REFRESH_COOKIE_NAME || 'debate_refresh',
    refreshCookieDomain: process.env.REFRESH_COOKIE_DOMAIN?.trim() || undefined,
    refreshCookieSecure:
      process.env.NODE_ENV === 'production'
        ? true
        : parseBoolean(process.env.REFRESH_COOKIE_SECURE, false),
    refreshCookieSameSite: parseSameSite(process.env.REFRESH_COOKIE_SAMESITE),
    refreshCookieMaxAgeMs: parseNumber(process.env.REFRESH_COOKIE_MAX_AGE_MS, 30 * 24 * 60 * 60 * 1000),
  },

  room: {
    defaultGracePeriodSeconds: parseInt(process.env.DEFAULT_GRACE_PERIOD_SECONDS || '30', 10),
    maxSpeakersDefault: parseInt(process.env.MAX_SPEAKERS_DEFAULT || '6', 10),
    micRequestCooldownSeconds: parseInt(process.env.MIC_REQUEST_COOLDOWN_SECONDS || '60', 10),
    inviteExpirySeconds: parseInt(process.env.INVITE_EXPIRY_SECONDS || '60', 10),
  },

  health: {
    strictExternals:
      process.env.NODE_ENV === 'production'
        ? true
        : parseBoolean(process.env.HEALTHCHECK_STRICT_EXTERNALS, false),
    externalCheckCacheTtlMs: parseNumber(process.env.EXTERNAL_CHECK_CACHE_TTL_MS, 30000),
  },

  ops: {
    enablePublicMetrics:
      process.env.NODE_ENV === 'production'
        ? parseBoolean(process.env.ENABLE_PUBLIC_METRICS, false)
        : parseBoolean(process.env.ENABLE_PUBLIC_METRICS, true),
    enableSwagger:
      process.env.NODE_ENV === 'production'
        ? parseBoolean(process.env.ENABLE_SWAGGER, false)
        : parseBoolean(process.env.ENABLE_SWAGGER, true),
    internalKey: process.env.INTERNAL_OPS_KEY || '',
  },

  migrations: {
    requireUpToDate:
      process.env.NODE_ENV === 'production'
        ? parseBoolean(process.env.REQUIRE_MIGRATIONS_UP_TO_DATE, true)
        : parseBoolean(process.env.REQUIRE_MIGRATIONS_UP_TO_DATE, false),
  },

  services: {
    livekitRequired:
      process.env.NODE_ENV === 'production'
        ? true
        : parseBoolean(process.env.LIVEKIT_REQUIRED, false),
    emailRequired:
      process.env.NODE_ENV === 'production'
        ? parseBoolean(process.env.EMAIL_REQUIRED, true)
        : parseBoolean(process.env.EMAIL_REQUIRED, false),
    smsRequired:
      process.env.NODE_ENV === 'production'
        ? parseBoolean(process.env.SMS_REQUIRED, false)
        : parseBoolean(process.env.SMS_REQUIRED, false),
    externalCheckTimeoutMs: parseNumber(process.env.EXTERNAL_CHECK_TIMEOUT_MS, 5000),
  },
};

export default config;
