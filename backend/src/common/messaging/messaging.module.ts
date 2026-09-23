import { Global, Module } from '@nestjs/common';

import { CloudTasksEnqueuer } from './cloud-tasks.enqueuer';
import { PubSubPublisher } from './pubsub.publisher';
import { InternalCallerGuard } from './internal-caller.guard';

@Global()
@Module({
  providers: [PubSubPublisher, CloudTasksEnqueuer, InternalCallerGuard],
  exports: [PubSubPublisher, CloudTasksEnqueuer, InternalCallerGuard],
})
export class MessagingModule {}
