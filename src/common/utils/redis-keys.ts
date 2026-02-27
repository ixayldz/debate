function resolvePrefix(): string {
  const rawPrefix = (
    process.env.REDIS_KEY_PREFIX ||
    (process.env.NODE_ENV === 'test' ? process.env.TEST_REDIS_PREFIX : '') ||
    ''
  ).trim();

  return rawPrefix.replace(/:+$/, '');
}

function withPrefix(key: string): string {
  const prefix = resolvePrefix();
  return prefix ? `${prefix}:${key}` : key;
}

export const RedisKeys = {
  roomState: (roomId: string) => withPrefix(`room:${roomId}:state`),
  roomSpeakers: (roomId: string) => withPrefix(`room:${roomId}:speakers`),
  roomListeners: (roomId: string) => withPrefix(`room:${roomId}:listeners`),
  roomModerators: (roomId: string) => withPrefix(`room:${roomId}:moderators`),
  roomMicQueue: (roomId: string) => withPrefix(`room:${roomId}:mic_queue`),
  roomPresence: (roomId: string) => withPrefix(`room:${roomId}:presence`),
  userRoom: (userId: string) => withPrefix(`user:${userId}:room`),
  roomInvite: (roomId: string, userId: string) => withPrefix(`room:${roomId}:invite:${userId}`),
  roomGraceTimer: (roomId: string) => withPrefix(`room:${roomId}:grace_timer`),
  userCooldown: (roomId: string, userId: string) => withPrefix(`room:${roomId}:cooldown:${userId}`),
  refreshToken: (userId: string) => withPrefix(`refresh_token:${userId}`),
  userPresence: (userId: string) => withPrefix(`user:${userId}:presence`),
  passwordResetToken: (userId: string) => withPrefix(`password_reset:${userId}`),
  passwordResetTokenByToken: (token: string) => withPrefix(`password_reset:token:${token}`),
  emailVerificationToken: (token: string) => withPrefix(`email_verification:${token}`),
  emailResendRateLimit: (userId: string) => withPrefix(`email:resend:${userId}`),
  phoneOtp: (phone: string) => withPrefix(`phone_otp:${phone}`),
  phoneOtpRateLimit: (phone: string) => withPrefix(`phone_otp:ratelimit:${phone}`),
  oauthState: (state: string) => withPrefix(`oauth:state:${state}`),
  authCode: (code: string) => withPrefix(`auth_code:${code}`),
  userFollowers: (userId: string) => withPrefix(`user:${userId}:followers`),
  userFollowing: (userId: string) => withPrefix(`user:${userId}:following`),
  userBlocked: (userId: string) => withPrefix(`user:${userId}:blocked`),
  notificationQueue: (userId: string) => withPrefix(`user:${userId}:notifications`),
  roomCategories: () => withPrefix('room:categories'),
  roomSearchIndex: () => withPrefix('room:search:index'),
};

export default RedisKeys;
