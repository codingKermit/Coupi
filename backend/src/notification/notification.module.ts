import { Module } from '@nestjs/common';

import { FcmClient } from './fcm.client';
import { NotificationService } from './notification.service';
import { PushDispatchController } from './push-dispatch.controller';

@Module({
  controllers: [PushDispatchController],
  providers: [FcmClient, NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
