import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { CouponClassifierModule } from './coupon-classifier/coupon-classifier.module';
import { CouponsModule } from './coupons/coupons.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { MailIngestModule } from './mail-ingest/mail-ingest.module';
import { NotificationModule } from './notification/notification.module';
import { UserModule } from './user/user.module';
import { validateEnv } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    MailIngestModule,
    CouponClassifierModule,
    NotificationModule,
    UserModule,
    CouponsModule,
    DevicesModule,
  ],
})
export class AppModule {}
