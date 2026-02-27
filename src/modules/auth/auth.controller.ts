import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { authService } from './auth.service.js';
import {
  registerSchema,
  loginSchema,
  requestPhoneOtpSchema,
  verifyPhoneOtpSchema,
  getZodErrorMessage,
} from '../../common/utils/validation.js';
import { BadRequestError, ServiceUnavailableError, UnauthorizedError } from '../../common/utils/app-error.js';
import { AuthenticatedRequest } from '../../common/guards/auth.guard.js';
import config from '../../config/index.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import {
  clearRefreshTokenCookie,
  getRefreshTokenFromRequest,
  setRefreshTokenCookie,
} from '../../common/utils/cookies.js';

const OAUTH_STATE_EXPIRY_SECONDS = 600; // 10 minutes

interface OAuthStateData {
  provider: 'google' | 'twitter';
  createdAt: number;
  frontendState: string;
  codeVerifier: string;
}

function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  return { codeVerifier, codeChallenge };
}

function toSafeOAuthErrorMessage(error: unknown): string {
  if (error instanceof UnauthorizedError) {
    return 'OAuth session is invalid or expired. Please try again.';
  }

  if (error instanceof ServiceUnavailableError) {
    return 'OAuth provider is not available right now.';
  }

  return 'OAuth login failed. Please try again.';
}

function assertOAuthProviderConfigured(provider: 'google' | 'twitter'): void {
  const providerConfig = provider === 'google' ? config.oauth.google : config.oauth.twitter;
  const missing: string[] = [];

  if (!providerConfig.clientId) missing.push(`${provider.toUpperCase()}_CLIENT_ID`);
  if (!providerConfig.clientSecret) missing.push(`${provider.toUpperCase()}_CLIENT_SECRET`);
  if (!providerConfig.callbackUrl) missing.push(`${provider.toUpperCase()}_CALLBACK_URL`);

  if (missing.length > 0) {
    throw new ServiceUnavailableError(
      `${provider} OAuth is not configured. Missing: ${missing.join(', ')}`
    );
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.parse(req.body);
      const { user, tokens } = await authService.register(parsed);
      if (tokens?.refreshToken) {
        setRefreshTokenCookie(res, tokens.refreshToken);
      }

      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          avatarUrl: user.avatar_url,
          language: user.language,
        },
        ...(tokens ? { accessToken: tokens.accessToken } : {}),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.parse(req.body);
      const { user, tokens } = await authService.login(parsed);
      setRefreshTokenCookie(res, tokens.refreshToken);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          email: user.email,
          avatarUrl: user.avatar_url,
          language: user.language,
        },
        accessToken: tokens.accessToken,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = getRefreshTokenFromRequest(req);
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token is required');
      }

      const tokens = await authService.refreshTokens(refreshToken);
      setRefreshTokenCookie(res, tokens.refreshToken);

      res.json({ accessToken: tokens.accessToken });
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        clearRefreshTokenCookie(res);
      }
      next(error);
    }
  }

  async requestPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = requestPhoneOtpSchema.parse(req.body);
      const result = await authService.requestPhoneOtp(parsed.phone);
      res.json(result);
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async verifyPhoneOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = verifyPhoneOtpSchema.parse(req.body);
      const { user, isNewUser, tokens } = await authService.verifyPhoneOtp({
        phone: parsed.phone!,
        code: parsed.code!,
        username: parsed.username,
        displayName: parsed.displayName,
        language: parsed.language,
      });
      setRefreshTokenCookie(res, tokens.refreshToken);

      res.json({
        user: {
          id: user.id,
          username: user.username,
          displayName: user.display_name,
          phone: user.phone,
          avatarUrl: user.avatar_url,
          language: user.language,
        },
        isNewUser,
        accessToken: tokens.accessToken,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        next(new BadRequestError(getZodErrorMessage(error), error));
        return;
      }
      next(error);
    }
  }

  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user?.userId) {
        await authService.logout(req.user.userId);
      }
      clearRefreshTokenCookie(res);

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  async getOAuthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;

      if (!['google', 'twitter'].includes(provider)) {
        throw new BadRequestError('Invalid OAuth provider');
      }

      assertOAuthProviderConfigured(provider as 'google' | 'twitter');
      const { codeVerifier, codeChallenge } = createPkcePair();
      const frontendState =
        typeof req.query.state === 'string'
          ? req.query.state.slice(0, 128)
          : '';

      // Generate secure state token for CSRF protection
      const state = crypto.randomUUID();
      const stateData: OAuthStateData = {
        provider: provider as 'google' | 'twitter',
        createdAt: Date.now(),
        frontendState,
        codeVerifier,
      };

      // Store state in Redis with expiry
      await redisClient.getClient().set(
        RedisKeys.oauthState(state),
        JSON.stringify(stateData),
        'EX',
        OAUTH_STATE_EXPIRY_SECONDS
      );

      let url = '';

      if (provider === 'google') {
        const params = new URLSearchParams({
          client_id: config.oauth.google.clientId,
          redirect_uri: config.oauth.google.callbackUrl,
          response_type: 'code',
          scope: 'openid email profile',
          access_type: 'offline',
          state: state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        } as any);
        url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
      } else if (provider === 'twitter') {
        const params = new URLSearchParams({
          client_id: config.oauth.twitter.clientId,
          redirect_uri: config.oauth.twitter.callbackUrl,
          response_type: 'code',
          scope: 'users.read email.read',
          state: state,
          code_challenge: codeChallenge,
          code_challenge_method: 'S256',
        } as any);
        url = `https://twitter.com/i/oauth2/authorize?${params}`;
      }

      res.json({ url, state });
    } catch (error) {
      next(error);
    }
  }

  async handleOAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { provider } = req.params;
      const code = req.query.code as string;
      const state = req.query.state as string;

      if (!code) {
        throw new BadRequestError('Authorization code not provided');
      }

      if (!state) {
        throw new BadRequestError('OAuth state is required');
      }

      if (!['google', 'twitter'].includes(provider)) {
        throw new BadRequestError('Invalid OAuth provider');
      }

      assertOAuthProviderConfigured(provider as 'google' | 'twitter');

      // Validate state for CSRF protection
      const stateKey = RedisKeys.oauthState(state);
      const storedStateData = await redisClient.getClient().get(stateKey);

      if (!storedStateData) {
        throw new UnauthorizedError('Invalid or expired OAuth state - CSRF protection triggered');
      }

      // Delete the state after retrieval (one-time use)
      await redisClient.getClient().del(stateKey);

      const stateData = JSON.parse(storedStateData) as OAuthStateData;

      // Verify the state belongs to the correct provider
      if (stateData.provider !== provider) {
        throw new BadRequestError('OAuth state provider mismatch');
      }

      if (!stateData.codeVerifier) {
        throw new UnauthorizedError('OAuth state is invalid');
      }

      // Check if state has expired (additional check beyond Redis TTL)
      const stateAge = Date.now() - stateData.createdAt;
      if (stateAge > OAUTH_STATE_EXPIRY_SECONDS * 1000) {
        throw new UnauthorizedError('OAuth state has expired');
      }

      let profile: {
        id: string;
        email?: string;
        displayName: string;
        username?: string;
      };

      if (provider === 'google') {
        const tokenResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: code,
            client_id: config.oauth.google.clientId,
            client_secret: config.oauth.google.clientSecret,
            redirect_uri: config.oauth.google.callbackUrl,
            grant_type: 'authorization_code',
            code_verifier: stateData.codeVerifier,
          } as any),
        }, config.services.externalCheckTimeoutMs);

        if (!tokenResponse.ok) {
          throw new BadRequestError(`Google OAuth token exchange failed (${tokenResponse.status})`);
        }

        const tokens = await tokenResponse.json() as { access_token: string };

        const userResponse = await fetchWithTimeout('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }, config.services.externalCheckTimeoutMs);

        if (!userResponse.ok) {
          throw new BadRequestError(`Google OAuth profile fetch failed (${userResponse.status})`);
        }

        const userData = await userResponse.json() as {
          id: string;
          email: string;
          name: string;
        };

        profile = {
          id: userData.id,
          email: userData.email,
          displayName: userData.name,
        };
      } else if (provider === 'twitter') {
        const tokenResponse = await fetchWithTimeout('https://api.twitter.com/2/oauth2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: code,
            grant_type: 'authorization_code',
            client_id: config.oauth.twitter.clientId,
            client_secret: config.oauth.twitter.clientSecret,
            redirect_uri: config.oauth.twitter.callbackUrl,
            code_verifier: stateData.codeVerifier,
          } as any),
        }, config.services.externalCheckTimeoutMs);

        if (!tokenResponse.ok) {
          throw new BadRequestError(`Twitter OAuth token exchange failed (${tokenResponse.status})`);
        }

        const tokens = await tokenResponse.json() as { access_token: string };

        const userResponse = await fetchWithTimeout('https://api.twitter.com/2/users/me', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        }, config.services.externalCheckTimeoutMs);

        if (!userResponse.ok) {
          throw new BadRequestError(`Twitter OAuth profile fetch failed (${userResponse.status})`);
        }

        const userData = await userResponse.json() as {
          data: { id: string; name: string; username: string };
        };

        profile = {
          id: userData.data.id,
          displayName: userData.data.name,
          username: userData.data.username,
        };
      } else {
        throw new BadRequestError('Invalid provider');
      }

      const { user, tokens } = await authService.handleOAuthLogin(
        provider as 'google' | 'twitter',
        profile
      );

      // Secure: use single-use auth code instead of tokens in URL
      const authCode = uuidv4();
      await redisClient.getClient().set(
        RedisKeys.authCode(authCode),
        JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          userId: user.id,
        }),
        'EX',
        60 // 60 seconds expiry
      );

      const redirectUrl = new URL(config.app.frontendUrl + '/oauth/callback');
      redirectUrl.searchParams.set('code', authCode);

      // Pass through the frontend state if it was provided
      if (stateData.frontendState) {
        redirectUrl.searchParams.set('state', stateData.frontendState);
      }

      res.redirect(redirectUrl.toString());
    } catch (error) {
      try {
        const redirectUrl = new URL(config.app.frontendUrl + '/oauth/callback');
        const message = toSafeOAuthErrorMessage(error);
        redirectUrl.searchParams.set('error', message);
        res.redirect(redirectUrl.toString());
      } catch {
        next(error);
      }
    }
  }

  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        throw new BadRequestError('Email is required');
      }

      const result = await authService.requestPasswordReset(email);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        throw new BadRequestError('Token and new password are required');
      }

      if (password.length < 8) {
        throw new BadRequestError('Password must be at least 8 characters');
      }

      const result = await authService.resetPassword(token, password);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        throw new BadRequestError('Verification token is required');
      }

      const result = await authService.verifyEmail(token);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async resendVerificationEmail(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.resendVerificationEmail(req.user!.userId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
export default authController;
