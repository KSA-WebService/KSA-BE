import { Allow } from 'class-validator';

export class VerifyInvitationDto {
  /*
   * 토큰의 상세 형식 검증은 Service에서 처리한다.
   *
   * 전역 ValidationPipe의 whitelist 옵션에서 제거되지 않도록
   * @Allow()를 사용한다.
   */
  @Allow()
  token?: unknown;
}

export interface VerifyInvitationResponse {
  name: string;
  email: string;
  studentNumber: string;
  expiresAt: string;
}
