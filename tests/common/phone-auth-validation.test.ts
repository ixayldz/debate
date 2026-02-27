import {
  requestPhoneOtpSchema,
  verifyPhoneOtpSchema,
} from '../../src/common/utils/validation.js';

describe('phone auth validation', () => {
  it('validates OTP request payload', () => {
    const parsed = requestPhoneOtpSchema.parse({
      phone: '+905551112233',
    });

    expect(parsed.phone).toBe('+905551112233');
  });

  it('validates OTP verify payload with registration fields', () => {
    const parsed = verifyPhoneOtpSchema.parse({
      phone: '+905551112233',
      code: '123456',
      username: 'new_user',
      displayName: 'New User',
      language: 'tr',
    });

    expect(parsed.code).toBe('123456');
    expect(parsed.username).toBe('new_user');
  });

  it('rejects invalid OTP code length', () => {
    expect(() =>
      verifyPhoneOtpSchema.parse({
        phone: '+905551112233',
        code: '1234',
      })
    ).toThrow('OTP must be 6 digits');
  });
});
