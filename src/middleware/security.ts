import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import xss from 'xss';
import config from '../config/index.js';

// XSS sanitization options - strict mode
const xssOptions = {
  whiteList: {}, // No HTML tags allowed
  stripIgnoreTag: true, // Strip disallowed tags
  stripIgnoreTagBody: ['script', 'style'], // Strip content of these tags
  css: false, // No CSS allowed
};

const sensitiveFieldNames = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'token',
  'refreshtoken',
  'accesstoken',
  'authorization',
  'otp',
  'code',
  'clientsecret',
  'apikey',
  'apisecret',
]);

function isSensitiveFieldName(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (sensitiveFieldNames.has(normalized)) {
    return true;
  }

  return (
    normalized.endsWith('token') ||
    normalized.endsWith('password') ||
    normalized.endsWith('secret')
  );
}

function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    // Decode URL-encoded strings first (handles double encoding)
    let decoded = value;
    try {
      let previous = '';
      while (previous !== decoded) {
        previous = decoded;
        decoded = decodeURIComponent(decoded);
      }
    } catch {
      // If decoding fails, use original value
      decoded = value;
    }

    // Apply XSS sanitization
    let sanitized = xss(decoded, xssOptions);

    // Additional protection against event handlers and javascript: URLs
    sanitized = sanitized
      .replace(/javascript\s*:/gi, '')
      .replace(/vbscript\s*:/gi, '')
      .replace(/data\s*:/gi, '')
      .replace(/on\w+\s*=/gi, 'data-blocked=');

    return sanitized;
  }

  if (Array.isArray(value)) {
    return value.map(item => sanitizeValue(item));
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      // Also sanitize object keys to prevent prototype pollution
      const sanitizedKey = sanitizeValue(key);
      if (
        sanitizedKey !== '__proto__' &&
        sanitizedKey !== 'constructor' &&
        sanitizedKey !== 'prototype'
      ) {
        if (isSensitiveFieldName(sanitizedKey)) {
          sanitized[sanitizedKey] = val;
        } else {
          sanitized[sanitizedKey] = sanitizeValue(val);
        }
      }
    }
    return sanitized;
  }

  return value;
}

export const securityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'https:'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'blob:'],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
});

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS?.split(',')
      .map(origin => origin.trim())
      .filter(Boolean)
      || [config.app.frontendUrl, config.app.apiUrl]
  );

  const origin = req.headers.origin;
  const allowAnyOrigin = allowedOrigins.includes('*');
  const isAllowedOrigin = !!origin && (allowAnyOrigin || allowedOrigins.includes(origin));

  if (isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (!origin && allowAnyOrigin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  const requestedHeaders = req.headers['access-control-request-headers'];
  const defaultAllowedHeaders = [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-Id',
    'X-Internal-Ops-Key',
    'Accept',
    'Origin',
  ];
  if (typeof requestedHeaders === 'string' && requestedHeaders.trim().length > 0) {
    res.setHeader('Access-Control-Allow-Headers', requestedHeaders);
  } else {
    res.setHeader('Access-Control-Allow-Headers', defaultAllowedHeaders.join(', '));
  }
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}

export function requestSanitizer(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize body, query, and params
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params);
  }

  next();
}
