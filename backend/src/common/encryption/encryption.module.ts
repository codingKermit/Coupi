import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EncryptionService } from './encryption.service';
import { KmsKeyProvider } from './kms-key-provider';
import { LocalKeyProvider } from './local-key-provider';
import { KEY_PROVIDER, type KeyProvider } from './key-provider.interface';

@Global()
@Module({
  providers: [
    {
      provide: KEY_PROVIDER,
      inject: [ConfigService],
      // KMS_KEY_NAME이 있으면 KMS를, 없으면 환경변수 마스터 키를 쓴다.
      // 로컬에서 KMS 없이 개발할 수 있게 하되, 운영 배포에서는 Terraform이
      // KMS_KEY_NAME을 주입하므로 자동으로 KMS 경로를 탄다.
      useFactory: (config: ConfigService): KeyProvider =>
        config.get<string>('KMS_KEY_NAME')
          ? new KmsKeyProvider(config)
          : new LocalKeyProvider(config),
    },
    EncryptionService,
  ],
  exports: [EncryptionService],
})
export class EncryptionModule {}
