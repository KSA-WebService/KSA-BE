import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Resend } from 'resend';

interface SendInvitationEmailParams {
  email: string;
  name: string;
  invitationUrl: string;
  expiresAt: Date;
  idempotencyKey: string;
}

interface SendInvitationEmailResult {
  providerMessageId: string;
}

@Injectable()
export class InvitationMailService {
  private readonly logger = new Logger(InvitationMailService.name);

  async sendInvitationEmail(
    params: SendInvitationEmailParams,
  ): Promise<SendInvitationEmailResult> {
    const mailMode = (process.env.INVITATION_MAIL_MODE ?? 'mock')
      .trim()
      .toLowerCase();

    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();

    if (mailMode === 'mock') {
      const isMockAllowed = nodeEnv === 'development' || nodeEnv === 'test';

      if (!isMockAllowed) {
        throw new Error(
          'Mock invitation mail mode is only allowed in development or test environments',
        );
      }

      return this.sendMockInvitationEmail(params);
    }

    if (mailMode === 'resend') {
      return this.sendResendInvitationEmail(params);
    }

    throw new Error(`Unsupported invitation mail mode: ${mailMode}`);
  }

  private sendMockInvitationEmail(
    params: SendInvitationEmailParams,
  ): Promise<SendInvitationEmailResult> {
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

    this.logger.log(
      `[MOCK] Invitation email accepted (${params.idempotencyKey})`,
    );

    /*
     * 로컬 Mock 테스트에서 명시적으로 허용한 경우에만
     * 원본 토큰이 포함된 초대 URL을 출력한다.
     *
     * 운영 환경에서는 절대 출력하지 않는다.
     */
    const shouldLogInvitationUrl =
      (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'development' &&
      (process.env.INVITATION_MOCK_LOG_URL ?? 'false').trim().toLowerCase() ===
        'true';

    if (shouldLogInvitationUrl) {
      this.logger.warn(
        `[LOCAL MOCK ONLY] Invitation URL (${params.idempotencyKey}): ${params.invitationUrl}`,
      );
    }

    return Promise.resolve({
      providerMessageId,
    });
  }

  private async sendResendInvitationEmail(
    params: SendInvitationEmailParams,
  ): Promise<SendInvitationEmailResult> {
    const apiKey = process.env.RESEND_API_KEY?.trim();

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured');
    }

    const fromEmail = process.env.INVITATION_FROM_EMAIL?.trim();

    if (!fromEmail) {
      throw new Error('INVITATION_FROM_EMAIL is not configured');
    }

    const resend = new Resend(apiKey);

    const expiresAt = params.expiresAt.toISOString();
    const escapedName = this.escapeHtml(params.name);
    const escapedInvitationUrl = this.escapeHtml(params.invitationUrl);

    const { data, error } = await resend.emails.send(
      {
        from: fromEmail,
        to: [params.email],
        subject: '[HKUST KSA] Complete your account registration',
        text: this.buildInvitationText({
          name: params.name,
          invitationUrl: params.invitationUrl,
          expiresAt,
        }),
        html: this.buildInvitationHtml({
          name: escapedName,
          invitationUrl: escapedInvitationUrl,
          expiresAt,
        }),
      },
      {
        idempotencyKey: params.idempotencyKey,
      },
    );

    if (error) {
      this.logger.error(
        `Resend invitation email failed (${params.idempotencyKey})`,
      );

      throw new Error('Resend invitation email sending failed');
    }

    if (!data?.id) {
      throw new Error('Resend did not return an email ID');
    }

    this.logger.log(
      `Invitation email accepted by Resend (${params.idempotencyKey}, messageId=${data.id})`,
    );

    return {
      providerMessageId: data.id,
    };
  }

  private buildInvitationText(params: {
    name: string;
    invitationUrl: string;
    expiresAt: string;
  }): string {
    return [
      `Hello ${params.name},`,
      '',
      'You have been invited to create your HKUST KSA account.',
      '',
      'Complete your registration using the link below:',
      params.invitationUrl,
      '',
      `This invitation expires at ${params.expiresAt}.`,
      '',
      'If you were not expecting this invitation, you can ignore this email.',
      '',
      'HKUST KSA',
    ].join('\n');
  }

  private buildInvitationHtml(params: {
    name: string;
    invitationUrl: string;
    expiresAt: string;
  }): string {
    return `
      <!doctype html>
      <html>
        <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#222222;">
          <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
            <div style="background:#ffffff;border-radius:8px;padding:32px;">
              <h2 style="margin:0 0 20px;">
                Welcome to HKUST KSA
              </h2>

              <p>Hello ${params.name},</p>

              <p>
                You have been invited to create your HKUST KSA account.
              </p>

              <p style="margin:28px 0;">
                <a
                  href="${params.invitationUrl}"
                  style="display:inline-block;padding:12px 20px;background:#111111;color:#ffffff;text-decoration:none;border-radius:6px;"
                >
                  Complete Registration
                </a>
              </p>

              <p>
                This invitation expires at
                <strong>${params.expiresAt}</strong>.
              </p>

              <p style="font-size:13px;color:#666666;">
                If the button does not work, copy and paste this URL into your browser:
              </p>

              <p style="font-size:13px;word-break:break-all;">
                ${params.invitationUrl}
              </p>

              <p style="margin-top:28px;color:#666666;">
                If you were not expecting this invitation, you can ignore this email.
              </p>

              <p style="margin-top:28px;">
                HKUST KSA
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
