import config from './index.js';
import { logger } from './logger.js';

function isLikelyPlaceholder(value: string): boolean {
  return /your-|your_|change|placeholder|example|dummy|test/i.test(value.trim());
}

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) {
    return '****';
  }

  return `${'*'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

interface TwilioSendResponse {
  sid?: string;
  message?: string;
  code?: number;
}

class SmsService {
  private accountSid: string;
  private authToken: string;
  private from: string;

  constructor() {
    this.accountSid = config.sms.accountSid?.trim() || '';
    this.authToken = config.sms.authToken?.trim() || '';
    this.from = config.sms.from?.trim() || '';
  }

  isConfigured(): boolean {
    if (!this.accountSid || !this.authToken || !this.from) {
      return false;
    }

    if (
      isLikelyPlaceholder(this.accountSid) ||
      isLikelyPlaceholder(this.authToken) ||
      isLikelyPlaceholder(this.from)
    ) {
      return false;
    }

    return true;
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    return `Basic ${token}`;
  }

  private async fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendOtp(
    to: string,
    code: string,
    expiresInSeconds: number
  ): Promise<{ ok: boolean; providerMessageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'SMS provider is not configured' };
    }

    const ttlMinutes = Math.max(1, Math.ceil(expiresInSeconds / 60));
    const body = `Debate verification code: ${code}. Expires in ${ttlMinutes} minutes.`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const params = new URLSearchParams({
      To: to,
      From: this.from,
      Body: body,
    });

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }, 8000);

      const payload = await response.json() as TwilioSendResponse;
      if (!response.ok) {
        return {
          ok: false,
          error: payload.message || `Twilio request failed with ${response.status}`,
        };
      }

      return {
        ok: true,
        providerMessageId: payload.sid,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMS error';
      logger.error({ to: maskPhone(to), message }, 'Failed to send SMS OTP');
      return { ok: false, error: message };
    }
  }

  async verifyConnection(timeoutMs = 5000): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'SMS provider is not configured' };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}.json`;

    try {
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
        },
      }, timeoutMs);

      if (!response.ok) {
        const payload = await response.json() as TwilioSendResponse;
        return {
          ok: false,
          error: payload.message || `Twilio verify failed with ${response.status}`,
        };
      }

      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMS verification error';
      logger.error({ message }, 'SMS provider connectivity verification failed');
      return { ok: false, error: message };
    }
  }
}

export const smsService = new SmsService();
export default smsService;
