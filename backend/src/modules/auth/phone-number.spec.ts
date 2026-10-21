import { BadRequestException } from '@nestjs/common';
import { normalizePakistanPhone } from './phone-number';

describe('normalizePakistanPhone', () => {
  it.each([
    ['0300 1234567', '+923001234567'],
    ['+92 (300) 1234567', '+923001234567'],
    ['00923001234567', '+923001234567'],
    ['923001234567', '+923001234567'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizePakistanPhone(input)).toBe(expected);
  });

  it.each(['0300123456', '+92300123456', '+14155552671', '02003001234567'])(
    'rejects invalid Pakistan phone %s',
    (input) => {
      expect(() => normalizePakistanPhone(input)).toThrow(BadRequestException);
    },
  );
});
