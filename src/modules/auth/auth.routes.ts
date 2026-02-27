import { Router, Response, NextFunction } from 'express';
import { authController } from './auth.controller.js';
import { authGuard, optionalAuth, AuthenticatedRequest } from '../../common/guards/auth.guard.js';
import { BadRequestError, UnauthorizedError } from '../../common/utils/app-error.js';
import { redisClient } from '../../config/redis.js';
import { authLoginLimiter } from '../../middleware/rate-limiter.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import { setRefreshTokenCookie } from '../../common/utils/cookies.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authLoginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/phone/request-otp', authController.requestPhoneOtp);
router.post('/phone/verify-otp', authController.verifyPhoneOtp);
router.post('/logout', optionalAuth, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  authController.logout(req, res, next);
});

router.post('/password-reset', authController.requestPasswordReset);
router.post('/password-reset/confirm', authController.resetPassword);

router.post('/email/verify', authController.verifyEmail);
router.post('/email/resend', authGuard, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  authController.resendVerificationEmail(req, res, next);
});

router.get('/oauth/:provider', authController.getOAuthUrl);
router.get('/oauth/:provider/callback', authController.handleOAuthCallback);

// OAuth auth code exchange — frontend sends short-lived code, receives tokens
router.post('/exchange-code', async (req, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    if (!code || typeof code !== 'string') {
      throw new BadRequestError('Authorization code is required');
    }

    const data = await redisClient.getClient().get(RedisKeys.authCode(code));
    if (!data) {
      throw new UnauthorizedError('Invalid or expired authorization code');
    }

    // Single-use: delete immediately
    await redisClient.getClient().del(RedisKeys.authCode(code));

    const parsed = JSON.parse(data) as {
      accessToken: string;
      refreshToken: string;
      userId: number;
    };

    setRefreshTokenCookie(res, parsed.refreshToken);

    res.json({
      accessToken: parsed.accessToken,
      userId: parsed.userId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
