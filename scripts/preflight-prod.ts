import config from '../src/config/index.js';
import { logger } from '../src/config/logger.js';
import database from '../src/config/database.js';
import { redisClient } from '../src/config/redis.js';
import { livekitService } from '../src/config/livekit.js';
import { emailService } from '../src/config/email.js';
import { smsService } from '../src/config/sms.js';

interface CheckResult {
  name: string;
  ok: boolean;
  required: boolean;
  details?: string;
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    await database.connect();
    await database.query('SELECT 1');
    return { name: 'database', ok: true, required: true };
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown database error';
    return { name: 'database', ok: false, required: true, details };
  }
}

async function checkRedis(): Promise<CheckResult> {
  try {
    await redisClient.connect();
    await redisClient.getClient().ping();
    return { name: 'redis', ok: true, required: true };
  } catch (error) {
    const details = error instanceof Error ? error.message : 'Unknown redis error';
    return { name: 'redis', ok: false, required: true, details };
  }
}

async function checkLiveKit(): Promise<CheckResult> {
  const required = config.services.livekitRequired;
  if (!livekitService.isConfigured()) {
    return {
      name: 'livekit',
      ok: !required,
      required,
      details: 'LiveKit is not configured',
    };
  }

  const verification = await livekitService.verifyConnection(config.services.externalCheckTimeoutMs);
  return {
    name: 'livekit',
    ok: verification.ok,
    required,
    details: verification.error,
  };
}

async function checkEmail(): Promise<CheckResult> {
  const required = config.services.emailRequired;
  if (!emailService.isConfigured()) {
    return {
      name: 'email',
      ok: !required,
      required,
      details: 'Email service is not configured',
    };
  }

  const verification = await emailService.verifyConnection(config.services.externalCheckTimeoutMs);
  return {
    name: 'email',
    ok: verification.ok,
    required,
    details: verification.error,
  };
}

async function checkSms(): Promise<CheckResult> {
  const required = config.services.smsRequired;
  if (!smsService.isConfigured()) {
    return {
      name: 'sms',
      ok: !required,
      required,
      details: 'SMS service is not configured',
    };
  }

  const verification = await smsService.verifyConnection(config.services.externalCheckTimeoutMs);
  return {
    name: 'sms',
    ok: verification.ok,
    required,
    details: verification.error,
  };
}

function report(results: CheckResult[]): void {
  for (const result of results) {
    if (result.ok) {
      logger.info({ service: result.name, required: result.required }, 'Preflight check passed');
      continue;
    }

    logger.error(
      {
        service: result.name,
        required: result.required,
        details: result.details,
      },
      'Preflight check failed'
    );
  }
}

async function cleanup(): Promise<void> {
  await Promise.allSettled([
    redisClient.disconnect(),
    database.disconnect(),
  ]);
}

async function main(): Promise<void> {
  const results = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkLiveKit(),
    checkEmail(),
    checkSms(),
  ]);

  report(results);

  const failingChecks = results.filter(result => !result.ok);
  if (failingChecks.length > 0) {
    process.exitCode = 1;
  }
}

void main().finally(cleanup);
