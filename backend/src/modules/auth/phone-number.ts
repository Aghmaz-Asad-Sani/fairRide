import { BadRequestException } from '@nestjs/common';

export function normalizePakistanPhone(value: string): string {
  const compact = value.trim().replace(/[\s()-]/g, '');
  let normalized: string;

  if (/^03\d{9}$/.test(compact)) {
    normalized = `+92${compact.slice(1)}`;
  } else if (/^00923\d{9}$/.test(compact)) {
    normalized = `+${compact.slice(2)}`;
  } else if (/^92(?:3\d{9})$/.test(compact)) {
    normalized = `+${compact}`;
  } else if (/^\+923\d{9}$/.test(compact)) {
    normalized = compact;
  } else {
    throw new BadRequestException(
      'Phone number must be a valid Pakistan mobile number',
    );
  }

  return normalized;
}
