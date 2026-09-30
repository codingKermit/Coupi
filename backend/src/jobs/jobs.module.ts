import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { GmailSafetyPollJob } from './gmail-safety-poll.job';
import { GmailWatchRenewalJob } from './gmail-watch-renewal.job';

/**
 * Cloud Run Jobs 진입점 모음 (`docs/05-백엔드아키텍처.md`).
 * HTTP 서버와 같은 이미지를 쓰고, 실행 시 인자로 어느 잡인지 고른다.
 */
@Module({
  imports: [AuthModule],
  providers: [GmailWatchRenewalJob, GmailSafetyPollJob],
  exports: [GmailWatchRenewalJob, GmailSafetyPollJob],
})
export class JobsModule {}
