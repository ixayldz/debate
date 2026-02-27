import { safeParseInt } from '../../src/common/utils/parse.js';

describe('safeParseInt', () => {
  it('parses valid integer strings', () => {
    expect(safeParseInt('42')).toBe(42);
  });

  it('parses valid numeric inputs', () => {
    expect(safeParseInt(7)).toBe(7);
  });

  it('throws on invalid values', () => {
    expect(() => safeParseInt('abc', 'userId')).toThrow('Invalid userId');
  });
});
