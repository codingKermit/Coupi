import { Global, Module } from '@nestjs/common';

import { CloudTasksEnqueuer } from './cloud-tasks.enqueuer';
import { PubSubPublisher } from './pubsub.publisher';
import { PubSubPushGuard } from './pubsub-push.guard';

@Global()
@Module({
  providers: [PubSubPublisher, CloudTasksEnqueuer, PubSubPushGuard],
  exports: [PubSubPublisher, CloudTasksEnqueuer, PubSubPushGuard],
})
export class MessagingModule {}
