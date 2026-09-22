import { Controller, Get } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Cloud Run 기동 확인용. 의존성을 건드리지 않는다. */
  @Get()
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  /** DB 연결까지 확인한다. */
  @Get('ready')
  async readiness(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
