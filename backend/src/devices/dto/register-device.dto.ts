import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

import { DEVICE_PLATFORMS, type DevicePlatform } from '../../common/types/domain';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fcmToken!: string;

  @IsIn(DEVICE_PLATFORMS)
  platform!: DevicePlatform;
}
