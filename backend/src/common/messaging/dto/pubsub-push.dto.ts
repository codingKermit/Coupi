import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

/** Pub/Sub push 구독이 보내는 본문 형태 (`docs/01-메일연동.md`). */
export class PubSubMessageDto {
  /** base64로 인코딩된 JSON 페이로드 */
  @IsString()
  @IsNotEmpty()
  data!: string;

  @IsString()
  @IsNotEmpty()
  messageId!: string;

  @IsString()
  @IsOptional()
  publishTime?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, string>;

  @IsString()
  @IsOptional()
  orderingKey?: string;
}

export class PubSubPushDto {
  @ValidateNested()
  @Type(() => PubSubMessageDto)
  message!: PubSubMessageDto;

  @IsString()
  @IsOptional()
  subscription?: string;
}

/** Gmail watch 알림의 페이로드 — data를 디코딩하면 이 형태다. */
export interface GmailNotification {
  emailAddress: string;
  historyId: string | number;
}
