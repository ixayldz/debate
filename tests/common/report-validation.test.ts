import { reportSchema } from '../../src/common/utils/validation.js';

describe('reportSchema', () => {
  it('validates user report payload', () => {
    const parsed = reportSchema.parse({
      targetType: 'user',
      targetId: '123',
      category: 'spam',
      description: 'Spam behavior',
    });

    expect(parsed.targetType).toBe('user');
  });

  it('validates room report payload', () => {
    const parsed = reportSchema.parse({
      targetType: 'room',
      roomId: '55',
      category: 'harassment',
      description: 'Abusive room behavior',
    });

    expect(parsed.targetType).toBe('room');
  });
});
