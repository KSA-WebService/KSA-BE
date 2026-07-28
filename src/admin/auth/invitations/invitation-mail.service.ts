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

    // raw token이 포함된 invitationUrl은 절대 로그에 출력하지 않는다.
    this.logger.log(`[MOCK] Invitation email accepted for ${params.email}`);

    return Promise.resolve({
      providerMessageId,
    });
  }
}
