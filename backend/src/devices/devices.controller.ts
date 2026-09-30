import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

@Controller('devices')
@UseGuards(SessionGuard)
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  async register(
    @CurrentUser() userId: string,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ deviceId: string }> {
    return {
      deviceId: await this.devices.register(userId, dto.fcmToken, dto.platform),
    };
  }

  @Delete(':id')
  @HttpCode(204)
  async unregister(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const result = await this.devices.unregister(userId, id);

    if (result === 'not_found') throw new NotFoundException();
    if (result === 'forbidden') throw new ForbiddenException();
  }
}
