import { KeyManagementServiceClient } from '@google-cloud/kms';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { KeyProvider } from './key-provider.interface';

/**
 * Cloud KMS로 DEK를 감싼다 (`docs/07-보안개인정보.md` envelope encryption).
 *
 * 마스터 키는 KMS 밖으로 나오지 않는다. 키 로테이션은 Terraform에서
 * 90일 주기로 설정되어 있다 (`infra/terraform/secrets.tf`).
 */
@Injectable()
export class KmsKeyProvider implements KeyProvider {
  readonly name = 'kms';
  private readonly client = new KeyManagementServiceClient();
  private readonly keyName: string;

  constructor(config: ConfigService) {
    const keyName = config.get<string>('KMS_KEY_NAME');
    if (!keyName) {
      throw new Error('KMS_KEY_NAME이 설정되지 않았다.');
    }
    this.keyName = keyName;
  }

  async wrapDek(dek: Buffer): Promise<string> {
    const [result] = await this.client.encrypt({
      name: this.keyName,
      plaintext: dek,
    });

    if (!result.ciphertext) {
      throw new Error('KMS encrypt가 ciphertext를 반환하지 않았다.');
    }

    return Buffer.from(result.ciphertext).toString('base64');
  }

  async unwrapDek(wrapped: string): Promise<Buffer> {
    const [result] = await this.client.decrypt({
      name: this.keyName,
      ciphertext: Buffer.from(wrapped, 'base64'),
    });

    if (!result.plaintext) {
      throw new Error('KMS decrypt가 plaintext를 반환하지 않았다.');
    }

    return Buffer.from(result.plaintext);
  }
}
