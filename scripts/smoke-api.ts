import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import dotenv from 'dotenv';
import path from 'path';
import RedisKeys from '../src/common/utils/redis-keys.js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

type JsonValue = Record<string, unknown> | unknown[] | string | number | boolean | null;

interface VerifyOtpResponse {
  accessToken: string;
  user: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface RegisterResponse {
  accessToken?: string;
  user: {
    id: number;
    username: string;
    displayName: string;
  };
}

interface CreateRoomResponse {
  id: number;
  title: string;
  status: string;
}

const smokeClientIp = `198.51.100.${Math.floor(10 + Math.random() * 200)}`;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createApiProcess(port: number): ChildProcessWithoutNullStreams {
  const require = createRequire(import.meta.url);
  const tsxCliPath = require.resolve('tsx/cli');

  const child = spawn(process.execPath, [tsxCliPath, 'src/app.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'test',
      RUN_MIGRATIONS: process.env.RUN_MIGRATIONS || 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  return child;
}

async function waitForServerReady(baseUrl: string, timeoutMs = 60_000): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/ready`, {
        signal: AbortSignal.timeout(2_000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(1_000);
  }

  throw new Error(`Server was not ready within ${timeoutMs}ms`);
}

async function requestJson<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: JsonValue,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const { payload } = await requestJsonWithMeta<T>(
    baseUrl,
    method,
    path,
    body,
    token,
    extraHeaders
  );
  return payload;
}

async function requestJsonWithMeta<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: JsonValue,
  token?: string,
  extraHeaders?: Record<string, string>
): Promise<{ payload: T; response: Response }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Forwarded-For': smokeClientIp,
    ...(extraHeaders || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  const raw = await response.text();
  const payload = raw.length > 0 ? JSON.parse(raw) : {};

  if (!response.ok) {
    throw new Error(
      `Request failed (${method} ${path}) status=${response.status} body=${JSON.stringify(payload)}`
    );
  }

  return { payload: payload as T, response };
}

function getSetCookieHeaders(response: Response): string[] {
  const headersAny = response.headers as unknown as { getSetCookie?: () => string[] };
  if (typeof headersAny.getSetCookie === 'function') {
    return headersAny.getSetCookie();
  }

  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function toCookieHeader(setCookies: string[]): string {
  return setCookies
    .map(cookie => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function buildPhone(): string {
  const part = Math.floor(100_000_000 + Math.random() * 900_000_000).toString();
  return `+1${part}`;
}

function readOptionalEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

async function waitForOtpCode(redis: Redis, phone: string, timeoutMs = 10_000): Promise<string> {
  const keyCandidates = [
    RedisKeys.phoneOtp(phone),
    RedisKeys.phoneOtp(phone.replace('+', '')),
    `phone_otp:${phone}`,
    `phone_otp:${phone.replace('+', '')}`,
  ];
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    for (const key of keyCandidates) {
      const code = await redis.get(key);
      if (code && /^\d{6}$/.test(code)) {
        return code;
      }
    }

    let cursor = '0';
    const normalizedPhoneDigits = phone.replace('+', '');
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `*phone_otp*${normalizedPhoneDigits}*`, 'COUNT', '100');
      cursor = nextCursor;
      for (const key of keys) {
        const code = await redis.get(key);
        if (code && /^\d{6}$/.test(code)) {
          return code;
        }
      }
    } while (cursor !== '0');

    const [genericCursor, genericKeys] = await redis.scan('0', 'MATCH', '*phone_otp:*', 'COUNT', '50');
    if (genericCursor !== undefined && genericKeys.length > 0) {
      for (const key of genericKeys) {
        const code = await redis.get(key);
        if (code && /^\d{6}$/.test(code)) {
          return code;
        }
      }
    }

    await sleep(250);
  }

  throw new Error(`OTP code not found in Redis for phone ${phone}`);
}

async function createPhoneUserAndToken(
  baseUrl: string,
  redis: Redis,
  rolePrefix: string,
  explicitPhone?: string
): Promise<VerifyOtpResponse> {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const phone = explicitPhone || buildPhone();

  await requestJson<{ success: boolean; expiresIn: number }>(
    baseUrl,
    'POST',
    '/auth/phone/request-otp',
    { phone }
  );

  const otpCode = await waitForOtpCode(redis, phone);
  const username = `${rolePrefix}_${suffix}`;
  const displayName = `${rolePrefix} ${suffix}`;

  return requestJson<VerifyOtpResponse>(
    baseUrl,
    'POST',
    '/auth/phone/verify-otp',
    {
      phone,
      code: otpCode,
      username,
      displayName,
      language: 'en',
    }
  );
}

async function loginWithEmail(
  baseUrl: string,
  email: string,
  password: string
): Promise<LoginResponse> {
  return requestJson<LoginResponse>(
    baseUrl,
    'POST',
    '/auth/login',
    {
      email,
      password,
    }
  );
}

async function createEmailUserAndToken(baseUrl: string, rolePrefix: string): Promise<LoginResponse> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 10_000).toString(36)}`;
  const username = `${rolePrefix}_${suffix}`.slice(0, 30);
  const displayName = `${rolePrefix} ${suffix}`;
  const email = `${username}@smoke.local`;
  const password = `Smoke${Math.floor(Math.random() * 10_000)}PassA1`;

  const register = await requestJson<RegisterResponse>(
    baseUrl,
    'POST',
    '/auth/register',
    {
      username,
      displayName,
      email,
      password,
      language: 'en',
    }
  );

  if (register.accessToken) {
    return {
      accessToken: register.accessToken,
      user: register.user,
    };
  }

  return loginWithEmail(baseUrl, email, password);
}

async function verifyRefreshCookieFlow(baseUrl: string): Promise<void> {
  const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 10_000).toString(36)}`;
  const username = `refresh_${suffix}`.slice(0, 30);
  const email = `${username}@smoke.local`;
  const password = `Smoke${Math.floor(Math.random() * 10_000)}PassA1`;

  await requestJson<RegisterResponse>(
    baseUrl,
    'POST',
    '/auth/register',
    {
      username,
      displayName: `Refresh ${suffix}`,
      email,
      password,
      language: 'en',
    }
  );

  const loginResult = await requestJsonWithMeta<LoginResponse>(
    baseUrl,
    'POST',
    '/auth/login',
    {
      email,
      password,
    }
  );

  const loginCookies = getSetCookieHeaders(loginResult.response);
  const cookieHeader = toCookieHeader(loginCookies);
  if (!cookieHeader) {
    throw new Error('Login did not return refresh cookie');
  }

  const refreshResult = await requestJsonWithMeta<{ accessToken: string }>(
    baseUrl,
    'POST',
    '/auth/refresh',
    {},
    undefined,
    { Cookie: cookieHeader }
  );

  if (!refreshResult.payload.accessToken) {
    throw new Error('Refresh flow did not return access token');
  }
}

async function stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  child.kill('SIGTERM');

  await Promise.race([
    new Promise<void>(resolve => {
      child.once('exit', () => resolve());
    }),
    sleep(10_000).then(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }),
  ]);
}

async function main(): Promise<void> {
  const port = Number(process.env.SMOKE_API_PORT || '3101');
  const baseUrl = `http://127.0.0.1:${port}`;

  const redis = new Redis({
    host: process.env.TEST_REDIS_HOST || process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.TEST_REDIS_PORT || process.env.REDIS_PORT || '6379'),
    password: process.env.TEST_REDIS_PASSWORD || process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
    maxRetriesPerRequest: 2,
  });

  const server = createApiProcess(port);
  let stderrBuffer = '';

  server.stdout.on('data', chunk => {
    process.stdout.write(`[api] ${chunk}`);
  });
  server.stderr.on('data', chunk => {
    const text = chunk.toString();
    stderrBuffer += text;
    process.stderr.write(`[api:err] ${text}`);
  });

  server.once('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      process.stderr.write(`[api] exited unexpectedly with code ${code}\n`);
    } else if (code === null && !signal) {
      process.stderr.write('[api] exited unexpectedly without code/signal\n');
    }
  });

  try {
    await waitForServerReady(baseUrl);
    await redis.connect();

    const smokeEmail = process.env.SMOKE_EMAIL;
    const smokePassword = process.env.SMOKE_PASSWORD;
    const smokeListenerEmail = process.env.SMOKE_LISTENER_EMAIL;
    const smokeListenerPassword = process.env.SMOKE_LISTENER_PASSWORD;

    let owner: VerifyOtpResponse | LoginResponse;
    let listener: VerifyOtpResponse | LoginResponse;

    if (smokeEmail && smokePassword) {
      owner = await loginWithEmail(baseUrl, smokeEmail, smokePassword);

      if (smokeListenerEmail && smokeListenerPassword) {
        listener = await loginWithEmail(baseUrl, smokeListenerEmail, smokeListenerPassword);
      } else {
        listener = owner;
      }
    } else if (readOptionalEnv('SMOKE_PHONE')) {
      const smokePhone = readOptionalEnv('SMOKE_PHONE');
      const smokeListenerPhone = readOptionalEnv('SMOKE_LISTENER_PHONE');
      const ownerPhone = smokePhone || buildPhone();

      owner = await createPhoneUserAndToken(baseUrl, redis, 'owner', ownerPhone);

      if (smokeListenerPhone && smokeListenerPhone !== ownerPhone) {
        listener = await createPhoneUserAndToken(baseUrl, redis, 'listener', smokeListenerPhone);
      } else {
        listener = owner;
      }
    } else {
      owner = await createEmailUserAndToken(baseUrl, 'owner');
      listener = await createEmailUserAndToken(baseUrl, 'listener');
    }

    await verifyRefreshCookieFlow(baseUrl);

    const room = await requestJson<CreateRoomResponse>(
      baseUrl,
      'POST',
      '/rooms',
      {
        title: `Smoke Room ${randomUUID()}`,
        description: 'API smoke room',
        category: 'science',
        language: 'en',
        visibility: 'public',
        maxSpeakers: 6,
        micRequestsEnabled: true,
      },
      owner.accessToken
    );

    if (!room.id) {
      throw new Error('Room creation returned invalid payload');
    }

    await requestJson<{ roomId: string; role: string }>(
      baseUrl,
      'POST',
      `/rooms/${room.id}/join`,
      {},
      owner.accessToken
    );

    await requestJson<{ roomId: string; role: string }>(
      baseUrl,
      'POST',
      `/rooms/${room.id}/join`,
      {},
      listener.accessToken
    );

    await requestJson<{ message: string }>(
      baseUrl,
      'POST',
      `/rooms/${room.id}/leave`,
      {},
      listener.accessToken
    );

    await requestJson<{ message: string }>(
      baseUrl,
      'POST',
      `/rooms/${room.id}/leave`,
      {},
      listener.accessToken
    );

    const participantsAfterLeave = await requestJson<{
      owner: { user_id: number } | null;
      moderators: Array<{ user_id: number }>;
      speakers: Array<{ user_id: number }>;
      listeners: Array<{ user_id: number }>;
    }>(
      baseUrl,
      'GET',
      `/rooms/${room.id}/participants`,
      undefined,
      owner.accessToken
    );

    const remainingUserIds = [
      ...(participantsAfterLeave.owner ? [participantsAfterLeave.owner.user_id] : []),
      ...participantsAfterLeave.moderators.map(participant => participant.user_id),
      ...participantsAfterLeave.speakers.map(participant => participant.user_id),
      ...participantsAfterLeave.listeners.map(participant => participant.user_id),
    ];

    if (remainingUserIds.includes(listener.user.id)) {
      throw new Error('Listener still appears in participants after leaving room');
    }

    const ownerLeave = await requestJson<{ message: string; gracePeriodEnd?: number }>(
      baseUrl,
      'POST',
      `/rooms/${room.id}/leave`,
      {},
      owner.accessToken
    );

    if (!ownerLeave.gracePeriodEnd) {
      throw new Error(`Owner leave did not start grace period: ${JSON.stringify(ownerLeave)}`);
    }

    await requestJson<{ message: string }>(
      baseUrl,
      'DELETE',
      `/rooms/${room.id}`,
      {},
      owner.accessToken
    );

    process.stdout.write('[smoke:api] API smoke checks completed successfully\n');
  } catch (error) {
    process.stderr.write(`[smoke:api] failed: ${(error as Error).message}\n`);
    if (stderrBuffer.length > 0) {
      process.stderr.write('[smoke:api] captured server stderr output above\n');
    }
    process.exitCode = 1;
  } finally {
    await Promise.allSettled([
      redis.quit(),
      stopProcess(server),
    ]);
  }
}

void main();
