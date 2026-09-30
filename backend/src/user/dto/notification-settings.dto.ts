import { IsBoolean } from 'class-validator';

export class NotificationSettingsDto {
  @IsBoolean()
  notificationsEnabled!: boolean;
}
