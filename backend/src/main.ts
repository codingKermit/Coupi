import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/errors/http-exception.filter';
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
 * 처리되지 않은 Promise 거부로 프로세스가 죽지 않게 한다.
 *
 * Node 15부터 기본 동작이 프로세스 종료다. 그런데 GCP 클라이언트 라이브러리는
 * 백그라운드에서 스텁 생성·배치 전송을 하다가 우리가 await하지 않는 경로로
 * 거부를 던질 수 있다. 그대로 두면 발행 한 번 실패에 Cloud Run 컨테이너가 죽고,
 * 처리 중이던 다른 요청까지 함께 날아간다 (2026-09-30 실제로 확인).
 *
 * @param mode 서버와 배치의 올바른 대응이 서로 다르다.
 *   - `server`: 기록만 하고 계속 받는다. 한 요청의 실패가 전체 가용성을 깨면 안 된다.
 *   - `job`: 기록하고 **종료 코드를 실패로 바꾼다.** 그냥 삼키면 실패한 배치가
 *     성공으로 보고되어 조용히 누락된다.
 */
function installCrashGuards(mode: 'server' | 'job'): void {
  process.on('unhandledRejection', (reason) => {
    Logger.error(
      reason instanceof Error
        ? (reason.stack ?? reason.message)
        : String(reason),
      undefined,
      'UnhandledRejection',
    );

    if (mode === 'job') process.exitCode = 1;
  });
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

  // 모든 오류를 { error: { code, message } } 한 형태로 내보낸다 (docs/03)
  app.useGlobalFilters(new HttpExceptionFilter());

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
    installCrashGuards('server');
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

  installCrashGuards('job');
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
