import bcrypt from 'bcryptjs';
import { userRepository } from '../user/user.repository.js';
import { UserStatus } from '../../types/enums.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from '../../common/utils/jwt.js';
import {
  ConflictError,
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  ServiceUnavailableError,
} from '../../common/utils/app-error.js';
import { AuthTokens, TokenPayload } from '../../types/global.js';
import { RegisterInput, LoginInput } from '../../common/utils/validation.js';
import { redisClient } from '../../config/redis.js';
import RedisKeys from '../../common/utils/redis-keys.js';
import { logger } from '../../config/logger.js';
import { emailService } from '../../config/email.js';
import { smsService } from '../../config/sms.js';
import { v4 as uuidv4 } from 'uuid';

function maskPhone(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.length <= 4) {
    return '****';
  }

  return `${'*'.repeat(trimmed.length - 4)}${trimmed.slice(-4)}`;
}

export class AuthService {
  async register(input: RegisterInput): Promise<{ user: any; tokens: AuthTokens | null }> {
    const existingUser = await userRepository.findByUsername(input.username);

    if (existingUser) {
      throw new ConflictError('Username already taken');
    }

    const normalizedEmail = input.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      throw new BadRequestError('Email is required');
    }

    const existingEmail = await userRepository.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictError('Email already registered');
    }

    const shouldVerifyEmail = emailService.isConfigured();
    const hashedPassword = await bcrypt.hash(input.password, 12);

    const user = await userRepository.createUser({
      username: input.username,
      display_name: input.displayName,
      email: normalizedEmail,
      password: hashedPassword,
      language: input.language,
      status: shouldVerifyEmail ? UserStatus.PENDING_EMAIL_VERIFICATION : UserStatus.ACTIVE,
    });

    // Send verification email only when SMTP is configured.
    if (shouldVerifyEmail && user.email) {
      const verificationToken = uuidv4();
      await redisClient.getClient().set(
        RedisKeys.emailVerificationToken(verificationToken),
        user.id.toString(),
        'EX',
        24 * 60 * 60 // 24 hours
      );
      const emailSent = await emailService.sendVerificationEmail(user.email, verificationToken);
      if (!emailSent) {
        throw new BadRequestError('Could not send verification email. Please try again later.');
      }
    }

    if (!shouldVerifyEmail) {
      logger.warn({ userId: user.id }, 'Email service unavailable: skipping email verification');
      const tokens = await this.generateTokens(user);
      logger.info({ userId: user.id }, 'User registered successfully (auto-activated)');
      return { user, tokens };
    }

    logger.info({ userId: user.id }, 'User registered successfully - pending email verification');
    return { user, tokens: null };
  }

  async login(input: LoginInput): Promise<{ user: any; tokens: AuthTokens }> {
    const user = await userRepository.findByEmail(input.email);

    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedError('Please use OAuth to login');
    }

    const isValidPassword = await bcrypt.compare(input.password, user.password);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (
      user.status === UserStatus.PENDING_VERIFICATION ||
      user.status === UserStatus.PENDING_EMAIL_VERIFICATION
    ) {
      throw new UnauthorizedError('Please verify your email before logging in');
    }

    if (user.status === UserStatus.PENDING_PHONE_VERIFICATION) {
      throw new UnauthorizedError('Please verify your phone before logging in');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Account is not active');
    }

    const tokens = await this.generateTokens(user);

    logger.info({ userId: user.id }, 'User logged in successfully');

    return { user, tokens };
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = verifyRefreshToken(refreshToken);
      
      const storedToken = await redisClient.getClient().get(
        RedisKeys.refreshToken(payload.userId)
      );

      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedError('Invalid refresh token');
      }

      const user = await userRepository.findById(parseInt(payload.userId));

      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedError('User not found or inactive');
      }

      await this.invalidateRefreshToken(payload.userId);
      
      const tokens = await this.generateTokens(user);

      return tokens;
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.invalidateRefreshToken(userId);
    logger.info({ userId }, 'User logged out');
  }

  private async ensureOAuthUserActive(user: any): Promise<any> {
    const status = user.status as string;
    if (
      status === UserStatus.PENDING_VERIFICATION ||
      status === UserStatus.PENDING_EMAIL_VERIFICATION ||
      status === UserStatus.PENDING_PHONE_VERIFICATION
    ) {
      const activated = await userRepository.updateUser(user.id, { status: UserStatus.ACTIVE });
      logger.info({ userId: user.id }, 'User auto-verified via OAuth login');
      return activated || { ...user, status: UserStatus.ACTIVE };
    }

    if (status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Account is not active');
    }

    return user;
  }

  async handleOAuthLogin(
    provider: 'google' | 'twitter',
    profile: {
      id: string;
      email?: string;
      displayName: string;
      username?: string;
    }
  ): Promise<{ user: any; isNewUser: boolean; tokens: AuthTokens }> {
    const normalizedEmail = profile.email?.trim().toLowerCase();

    const existingProviderUser = await userRepository.findByProviderId(provider, profile.id);
    if (existingProviderUser) {
      const activeUser = await this.ensureOAuthUserActive(existingProviderUser);
      const tokens = await this.generateTokens(activeUser);
      return { user: activeUser, isNewUser: false, tokens };
    }

    const existingEmail = normalizedEmail
      ? await userRepository.findByEmail(normalizedEmail)
      : null;

    if (existingEmail) {
      const linkedUser =
        await userRepository.linkOAuthProvider(existingEmail.id, provider, {
          id: profile.id,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
        })
        || existingEmail;

      const activeUser = await this.ensureOAuthUserActive(linkedUser);
      const tokens = await this.generateTokens(activeUser);
      return { user: activeUser, isNewUser: false, tokens };
    }

    const usernameSeed = profile.username || profile.displayName || `${provider}_user`;
    const normalizedSeed = usernameSeed
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30);

    const username = normalizedSeed || `${provider}_user`;
    let usernameSuffix = 0;
    let finalUsername = username;

    while (await userRepository.findByUsername(finalUsername)) {
      usernameSuffix++;
      const suffix = String(usernameSuffix);
      finalUsername = `${username.slice(0, Math.max(1, 30 - suffix.length))}${suffix}`;
    }

    // OAuth users are auto-verified since email is verified by provider
    const user = await userRepository.createUser({
      username: finalUsername,
      display_name: profile.displayName,
      email: normalizedEmail,
      status: UserStatus.ACTIVE,
      providers: {
        [provider]: {
          id: profile.id,
          ...(normalizedEmail ? { email: normalizedEmail } : {}),
        },
      },
    });

    const tokens = await this.generateTokens(user);

    logger.info({ userId: user.id, provider }, 'New user registered via OAuth');

    return { user, isNewUser: true, tokens };
  }

  private async generateTokens(user: any): Promise<AuthTokens> {
    const payload: TokenPayload = {
      userId: user.id.toString(),
      email: user.email || '',
      username: user.username || '',
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    await redisClient.getClient().set(
      RedisKeys.refreshToken(user.id.toString()),
      refreshToken,
      'EX',
      30 * 24 * 60 * 60
    );

    return { accessToken, refreshToken };
  }

  private async invalidateRefreshToken(userId: string): Promise<void> {
    await redisClient.getClient().del(RedisKeys.refreshToken(userId));
  }

  async requestPhoneOtp(phone: string): Promise<{ success: boolean; expiresIn: number; deliveryId?: string }> {
    const normalizedPhone = phone.trim();
    const rateLimitKey = RedisKeys.phoneOtpRateLimit(normalizedPhone);
    const existingRateLimit = await redisClient.getClient().get(rateLimitKey);

    if (existingRateLimit) {
      throw new ConflictError('Please wait before requesting a new OTP');
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = RedisKeys.phoneOtp(normalizedPhone);
    const expirySeconds = 5 * 60;

    await redisClient.getClient().set(otpKey, otpCode, 'EX', expirySeconds);
    await redisClient.getClient().set(rateLimitKey, '1', 'EX', 60);

    if (!smsService.isConfigured()) {
      if (process.env.NODE_ENV === 'test') {
        logger.warn({ phone: maskPhone(normalizedPhone) }, 'SMS provider not configured in test environment');
        return { success: true, expiresIn: expirySeconds };
      }

      await redisClient.getClient().del(otpKey);
      await redisClient.getClient().del(rateLimitKey);
      throw new ServiceUnavailableError('SMS service is not available');
    }

    const delivery = await smsService.sendOtp(normalizedPhone, otpCode, expirySeconds);
    if (!delivery.ok) {
      await redisClient.getClient().del(otpKey);
      await redisClient.getClient().del(rateLimitKey);
      throw new ServiceUnavailableError(delivery.error || 'Failed to deliver OTP SMS');
    }

    logger.info(
      { phone: maskPhone(normalizedPhone), providerMessageId: delivery.providerMessageId },
      'Phone OTP delivered'
    );

    return { success: true, expiresIn: expirySeconds, deliveryId: delivery.providerMessageId };
  }

  async verifyPhoneOtp(input: {
    phone: string;
    code: string;
    username?: string;
    displayName?: string;
    language?: string;
  }): Promise<{ user: any; isNewUser: boolean; tokens: AuthTokens }> {
    const normalizedPhone = input.phone.trim();
    const otpKey = RedisKeys.phoneOtp(normalizedPhone);
    const storedOtp = await redisClient.getClient().get(otpKey);

    if (!storedOtp || storedOtp !== input.code) {
      throw new UnauthorizedError('Invalid or expired OTP');
    }

    await redisClient.getClient().del(otpKey);

    const existingUser = await userRepository.findByPhone(normalizedPhone);
    if (existingUser) {
      if (existingUser.status === UserStatus.PENDING_PHONE_VERIFICATION) {
        await userRepository.updateUser(existingUser.id, { status: UserStatus.ACTIVE });
        existingUser.status = UserStatus.ACTIVE;
      }

      if (existingUser.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedError('Account is not active');
      }

      const tokens = await this.generateTokens(existingUser);
      return { user: existingUser, isNewUser: false, tokens };
    }

    if (!input.username || !input.displayName) {
      throw new BadRequestError('username and displayName are required for new phone registrations');
    }

    const existingUsername = await userRepository.findByUsername(input.username);
    if (existingUsername) {
      throw new ConflictError('Username already taken');
    }

    const user = await userRepository.createUser({
      username: input.username,
      display_name: input.displayName,
      phone: normalizedPhone,
      language: input.language || 'tr',
      status: UserStatus.ACTIVE,
    });

    const tokens = await this.generateTokens(user);
    return { user, isNewUser: true, tokens };
  }

  async requestPasswordReset(email: string): Promise<{ success: boolean }> {
    if (!emailService.isConfigured()) {
      throw new BadRequestError('Email service is not available');
    }

    const user = await userRepository.findByEmail(email);

    if (!user) {
      return { success: true };
    }

    const resetToken = uuidv4();
    const expirySeconds = 3600;

    const previousToken = await redisClient.getClient().get(
      RedisKeys.passwordResetToken(user.id.toString())
    );
    if (previousToken) {
      await redisClient.getClient().del(RedisKeys.passwordResetTokenByToken(previousToken));
    }

    // Store token -> userId mapping (for password reset verification)
    await redisClient.getClient().set(
      RedisKeys.passwordResetTokenByToken(resetToken),
      user.id.toString(),
      'EX',
      expirySeconds
    );

    // Also store userId -> token mapping (for invalidation purposes)
    await redisClient.getClient().set(
      RedisKeys.passwordResetToken(user.id.toString()),
      resetToken,
      'EX',
      expirySeconds
    );

    const emailSent = await emailService.sendPasswordResetEmail(user.email!, resetToken);
    if (!emailSent) {
      throw new BadRequestError('Could not send password reset email. Please try again later.');
    }

    logger.info({ userId: user.id }, 'Password reset requested');

    return { success: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    // Get userId from token -> userId mapping
    const userId = await redisClient.getClient().get(
      RedisKeys.passwordResetTokenByToken(token)
    );

    if (!userId) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const user = await userRepository.findById(parseInt(userId));

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await userRepository.updateUser(parseInt(userId), {
      password: hashedPassword,
    });

    // Clean up both token mappings
    await redisClient.getClient().del(RedisKeys.passwordResetTokenByToken(token));
    await redisClient.getClient().del(RedisKeys.passwordResetToken(userId));

    await this.invalidateRefreshToken(userId);

    logger.info({ userId }, 'Password reset successfully');

    return { success: true };
  }

  async verifyEmail(token: string): Promise<{ success: boolean }> {
    const userId = await redisClient.getClient().get(
      RedisKeys.emailVerificationToken(token)
    );

    if (!userId) {
      throw new UnauthorizedError('Invalid or expired verification token');
    }

    const user = await userRepository.findById(parseInt(userId));
    
    if (!user) {
      throw new NotFoundError('User not found');
    }

    await userRepository.updateUser(parseInt(userId), {
      status: UserStatus.ACTIVE,
    });

    await redisClient.getClient().del(RedisKeys.emailVerificationToken(token));

    logger.info({ userId }, 'Email verified successfully');

    return { success: true };
  }

  async resendVerificationEmail(userId: string): Promise<{ success: boolean }> {
    if (!emailService.isConfigured()) {
      throw new BadRequestError('Email service is not available');
    }

    const user = await userRepository.findById(parseInt(userId));

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.status === UserStatus.ACTIVE) {
      return { success: true };
    }

    // Rate limit: 1 request per minute
    const rateLimitKey = RedisKeys.emailResendRateLimit(userId);
    const existing = await redisClient.getClient().get(rateLimitKey);
    if (existing) {
      throw new ConflictError('Please wait before requesting another verification email');
    }

    const verificationToken = uuidv4();

    await redisClient.getClient().set(
      RedisKeys.emailVerificationToken(verificationToken),
      userId,
      'EX',
      24 * 60 * 60
    );

    // Set rate limit for 60 seconds
    await redisClient.getClient().set(rateLimitKey, '1', 'EX', 60);

    const emailSent = await emailService.sendVerificationEmail(user.email!, verificationToken);
    if (!emailSent) {
      throw new BadRequestError('Could not resend verification email. Please try again later.');
    }

    logger.info({ userId }, 'Verification email resent');

    return { success: true };
  }
}

export const authService = new AuthService();
export default authService;
