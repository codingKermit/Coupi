import { ConfigService } from '@nestjs/config';

import { PubSubPublisher } from './pubsub.publisher';

/**
 * 실제 Pub/Sub 대신 topic 객체만 가짜로 끼운다.
 * 검증 대상은 발행 실패 시의 복구 동작이다.
 */
const build = (publishImpl: () => Promise<string>) => {
  const resumed: string[] = [];
  const topic = {
    publishMessage: jest.fn(
      (_msg: { data: Buffer; orderingKey?: string }) => publishImpl(),
    ),
    resumePublishing: jest.fn((key: string) => {
      resumed.push(key);
    }),
  };

  const config = {
    getOrThrow: () => 'test-project',
  } as unknown as ConfigService;

  const publisher = new PubSubPublisher(config);
  // 클라이언트를 건드리지 않도록 topic 해석만 대체한다.
  (publisher as unknown as { topicFor: () => unknown }).topicFor = () => topic;

  return { publisher, topic, resumed };
};

describe('PubSubPublisher', () => {
  it('페이로드를 JSON base64로 실어 보낸다', async () => {
    const { publisher, topic } = build(async () => 'mid-1');

    const id = await publisher.publish('t', { a: 1 }, 'key-1');

    expect(id).toBe('mid-1');
    const arg = topic.publishMessage.mock.calls[0][0];
    expect(JSON.parse(arg.data.toString('utf8'))).toEqual({ a: 1 });
    expect(arg.orderingKey).toBe('key-1');
  });

  it('ordering key가 없으면 붙이지 않는다', async () => {
    const { publisher, topic } = build(async () => 'mid-2');

    await publisher.publish('t', { a: 1 });

    const arg = topic.publishMessage.mock.calls[0][0];
    expect(arg.orderingKey).toBeUndefined();
  });

  it('발행이 실패하면 ordering key 정지를 풀고 오류를 올린다', async () => {
    const { publisher, resumed } = build(async () => {
      throw new Error('boom');
    });

    await expect(publisher.publish('t', { a: 1 }, 'key-1')).rejects.toThrow(
      'boom',
    );

    // 풀어주지 않으면 그 계정의 이후 메시지가 전부 실패한다.
    expect(resumed).toEqual(['key-1']);
  });

  it('ordering key가 없는 실패에서는 resume을 호출하지 않는다', async () => {
    const { publisher, resumed } = build(async () => {
      throw new Error('boom');
    });

    await expect(publisher.publish('t', { a: 1 })).rejects.toThrow('boom');

    expect(resumed).toEqual([]);
  });
});
