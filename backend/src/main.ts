import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { GmailSafetyPollJob } from './jobs/gmail-safety-poll.job';
import { GmailWatchRenewalJob } from './jobs/gmail-watch-renewal.job';

/**
 * Cloud Run Job으로 실행할 때 쓰는 인자 → 잡 매핑.
 * Terraform의 `args = ["jobs/gmail-watch-renewal"]`와 맞춰야 한다
 * (`infra/terraform/scheduler.tf`).
 */
const JOBS = {
  'jobs/gmail-watch-renewal': GmailWatchRenewalJob,
  'jobs/gmail-safety-poll': GmailSafetyPollJob,
} as const;

type JobName = keyof typeof JOBS;

function isJobName(value: string | undefined): value is JobName {
  return value !== undefined && value in JOBS;
}

/**
 * 서버와 배치가 같은 이미지를 쓴다. 인자가 있으면 배치, 없으면 HTTP 서버로 뜬다.
 * 이미지를 하나로 유지하면 빌드·배포 파이프라인도 하나면 된다 (`docs/05`).
 */
async function runJob(name: JobName): Promise<void> {
  // 배치는 HTTP 리스너가 필요 없다.
  const context = await NestFactory.createApplicationContext(AppModule);

  try {
    const job = context.get(JOBS[name]);
    const result = await job.run();
    Logger.log(`${name} 완료: ${JSON.stringify(result)}`, 'JobRunner');
  } finally {
    await context.close();
  }
}

async function runServer(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Cloud Run은 PORT 환경변수로 수신 포트를 지정한다.
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port, '0.0.0.0');

  Logger.log(`Coupi API listening on :${port}`, 'Bootstrap');
}

async function bootstrap(): Promise<void> {
  const arg = process.argv[2];

  if (arg === undefined) {
    await runServer();
    return;
  }

  if (!isJobName(arg)) {
    Logger.error(
      `알 수 없는 잡: ${arg} (가능: ${Object.keys(JOBS).join(', ')})`,
      undefined,
      'JobRunner',
    );
    process.exitCode = 1;
    return;
  }

  await runJob(arg);
}

void bootstrap().catch((error: unknown) => {
  Logger.error(
    error instanceof Error ? error.stack : String(error),
    undefined,
    'Bootstrap',
  );
  process.exitCode = 1;
});
