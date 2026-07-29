import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface SendInvitationEmailParams {
  email: string;
  name: string;
  invitationUrl: string;
  expiresAt: Date;
}

interface SendInvitationEmailResult {
  providerMessageId: string;
}

@Injectable()
export class InvitationMailService {
  private readonly logger = new Logger(InvitationMailService.name);

  sendInvitationEmail(
    params: SendInvitationEmailParams,
  ): Promise<SendInvitationEmailResult> {
    const mailMode = (process.env.INVITATION_MAIL_MODE ?? 'mock').toLowerCase();

    if (mailMode !== 'mock') {
      throw new Error(`Unsupported invitation mail mode: ${mailMode}`);
    }

    const failureEmails = new Set(
      (process.env.INVITATION_MOCK_FAILURE_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    );

    if (failureEmails.has(params.email.toLowerCase())) {
      throw new Error('Mock invitation email sending failed');
    }

    const providerMessageId = `mock-${randomUUID()}`;

    this.logger.log(`[MOCK] Invitation email accepted for ${params.email}`);

    /*
     * 로컬 Mock 테스트에서 명시적으로 허용한 경우에만
     * 원본 토큰이 포함된 초대 URL을 출력한다.
     *
     * 운영 환경에서는 절대 출력하지 않는다.
     */
    const shouldLogInvitationUrl =
      process.env.NODE_ENV !== 'production' &&
      (process.env.INVITATION_MOCK_LOG_URL ?? 'false').trim().toLowerCase() ===
        'true';

    if (shouldLogInvitationUrl) {
      this.logger.warn(
        `[LOCAL MOCK ONLY] Invitation URL for ${params.email}: ${params.invitationUrl}`,
      );
    }

    return Promise.resolve({
      providerMessageId,
    });
  }
}
