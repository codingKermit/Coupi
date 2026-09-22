import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { CouponClassifierModule } from '../coupon-classifier/coupon-classifier.module';
import { GmailWebhookController } from './gmail-webhook.controller';
import { MailIngestController } from './mail-ingest.controller';
import { MailIngestService } from './mail-ingest.service';


@Module({
  imports: [AuthModule, CouponClassifierModule],
  controllers: [GmailWebhookController, MailIngestController],
  providers: [MailIngestService],
  exports: [MailIngestService],
})
export class MailIngestModule {}
