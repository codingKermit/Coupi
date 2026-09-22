import { Global, Module } from '@nestjs/common';

import { PubSubPublisher } from './pubsub.publisher';

@Global()
@Module({
  providers: [PubSubPublisher],
  exports: [PubSubPublisher],
})
export class MessagingModule {}
