import { IsNotEmpty, IsString } from 'class-validator';

export class GmailCallbackDto {
  /** Google 동의 화면이 돌려준 인증 코드 */
  @IsString()
  @IsNotEmpty()
  code!: string;

  /** `/auth/gmail/url`이 발급한 state — CSRF 방지 */
  @IsString()
  @IsNotEmpty()
  state!: string;
}
