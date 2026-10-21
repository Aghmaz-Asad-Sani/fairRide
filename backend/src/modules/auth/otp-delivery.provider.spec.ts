import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DevelopmentOtpProvider } from './otp-delivery.provider';

describe('DevelopmentOtpProvider', () => {
  it('returns a code only when explicitly enabled in development', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'NODE_ENV'
          ? 'development'
          : key === 'OTP_DEV_RETURN_CODE'
            ? true
            : undefined,
      ),
    } as unknown as ConfigService;
    const provider = new DevelopmentOtpProvider(config);

    await expect(provider.deliver('+923001234567', '123456')).resolves.toEqual({
      developmentCode: '123456',
    });
  });

  it('never returns a development code in production', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'NODE_ENV'
          ? 'production'
          : key === 'OTP_DEV_RETURN_CODE'
            ? true
            : undefined,
      ),
    } as unknown as ConfigService;
    const provider = new DevelopmentOtpProvider(config);

    await expect(
      provider.deliver('+923001234567', '123456'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
