import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OtpDeliveryResult {
  developmentCode?: string;
}

export abstract class OtpDeliveryProvider {
  abstract deliver(phone: string, code: string): Promise<OtpDeliveryResult>;
}

@Injectable()
export class DevelopmentOtpProvider extends OtpDeliveryProvider {
  constructor(private readonly config: ConfigService) {
    super();
  }

  deliver(_phone: string, code: string): Promise<OtpDeliveryResult> {
    if (
      this.config.get<string>('NODE_ENV') !== 'development' ||
      !this.config.get<boolean>('OTP_DEV_RETURN_CODE', false)
    ) {
      return Promise.reject(
        new ServiceUnavailableException(
          'No OTP delivery provider is configured; set up an approved SMS provider',
        ),
      );
    }
    return Promise.resolve({ developmentCode: code });
  }
}
