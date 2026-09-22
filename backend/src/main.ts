import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
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

void bootstrap();
