import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { isEmail } from 'class-validator';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvitationMailService } from './invitation-mail.service';
import {
  SendInvitationResult,
  SendInvitationsDto,
  SendInvitationsResponse,
} from './dto/send-invitations.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationMailService: InvitationMailService,
  ) {}

  async send(
    dto: SendInvitationsDto,
    adminId: string,
  ): Promise<SendInvitationsResponse> {
    const signupUrl = this.getSignupUrl();

    const whitelistUsers = await this.prisma.whitelistedUser.findMany({
      where: {
        id: {
          in: dto.whitelistUserIds,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        userId: true,
        invitationStatus: true,
      },
    });

    const whitelistUserMap = new Map(
      whitelistUsers.map((whitelistUser) => [whitelistUser.id, whitelistUser]),
    );

    const results: SendInvitationResult[] = [];

    /*
     * 요청 순서를 유지하기 위해 DB 조회 결과가 아니라
     * dto.whitelistUserIds 순서대로 반복한다.
     */
    for (const whitelistUserId of dto.whitelistUserIds) {
      const whitelistUser = whitelistUserMap.get(whitelistUserId);

      if (!whitelistUser) {
        results.push({
          whitelistUserId,
          email: null,
          invitationId: null,
          sendStatus: 'FAILED',
          invitationStatus: null,
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I404_WHITELIST_USER',
          errorMessage: 'Whitelist user not found',
        });

        continue;
      }

      /*
       * 이미 회원 계정과 연결된 경우
       */
      if (whitelistUser.userId !== null) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: 'SKIPPED',
          invitationStatus: whitelistUser.invitationStatus,
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_ACCOUNT_ALREADY_LINKED',
          errorMessage: 'The whitelist user is already linked to an account',
        });

        continue;
      }

      /*
       * 가입 완료된 대상
       */
      if (
        whitelistUser.invitationStatus === WhitelistInvitationStatus.ACCEPTED
      ) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: 'SKIPPED',
          invitationStatus: whitelistUser.invitationStatus,
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_INVITATION_ACCEPTED',
          errorMessage: 'The invitation has already been accepted',
        });

        continue;
      }

      /*
       * 이미 최초 초대를 발송한 대상
       */
      if (
        whitelistUser.invitationStatus === WhitelistInvitationStatus.INVITED
      ) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: 'SKIPPED',
          invitationStatus: whitelistUser.invitationStatus,
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_ALREADY_INVITED',
          errorMessage:
            'An invitation has already been sent. Use the resend API.',
        });

        continue;
      }

      /*
       * EXPIRED 또는 FAILED는 재발송 API 대상
       */
      if (
        whitelistUser.invitationStatus === WhitelistInvitationStatus.EXPIRED ||
        whitelistUser.invitationStatus === WhitelistInvitationStatus.FAILED
      ) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: 'SKIPPED',
          invitationStatus: whitelistUser.invitationStatus,
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_RESEND_REQUIRED',
          errorMessage:
            'This whitelist user must be processed through the resend API',
        });

        continue;
      }

      /*
       * PENDING 상태만 여기까지 도달한다.
       */
      const normalizedEmail = whitelistUser.email.trim().toLowerCase();

      if (!this.isAllowedEmail(normalizedEmail)) {
        results.push({
          whitelistUserId,
          email: normalizedEmail,
          invitationId: null,
          sendStatus: 'FAILED',
          invitationStatus: whitelistUser.invitationStatus,
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I400_INVALID_WHITELIST_EMAIL',
          errorMessage: 'Only @connect.ust.hk email addresses are allowed',
        });

        continue;
      }

      const sentAt = new Date();

      const expiresAt = new Date(
        sentAt.getTime() + dto.expiresInHours * 60 * 60 * 1000,
      );

      /*
       * 원본 토큰은 이메일 링크에만 사용한다.
       */
      const rawToken = randomBytes(32).toString('base64url');

      /*
       * DB에는 SHA-256 해시만 저장한다.
       */
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      const invitationUrl = this.buildInvitationUrl(signupUrl, rawToken);

      /*
       * 이메일 발송 시도 전에 Invitation 기록을 만든다.
       */
      const invitation = await this.prisma.invitation.create({
        data: {
          whitelistUserId,
          sentBy: adminId,
          tokenHash,
          linkStatus: InvitationLinkStatus.ACTIVE,
          sentAt,
          expiresAt,
        },
        select: {
          id: true,
        },
      });

      try {
        await this.invitationMailService.sendInvitationEmail({
          email: normalizedEmail,
          name: whitelistUser.name,
          invitationUrl,
          expiresAt,
        });
      } catch {
        /*
         * 메일 발송 실패:
         * Invitation과 WhitelistedUser를 FAILED 처리한다.
         */
        await this.prisma.$transaction([
          this.prisma.invitation.update({
            where: {
              id: invitation.id,
            },
            data: {
              linkStatus: InvitationLinkStatus.FAILED,
            },
          }),
          this.prisma.whitelistedUser.updateMany({
            where: {
              id: whitelistUserId,
              userId: null,
              invitationStatus: WhitelistInvitationStatus.PENDING,
            },
            data: {
              invitationStatus: WhitelistInvitationStatus.FAILED,
            },
          }),
        ]);

        results.push({
          whitelistUserId,
          email: normalizedEmail,
          invitationId: invitation.id,
          sendStatus: 'FAILED',
          invitationStatus: WhitelistInvitationStatus.FAILED,
          linkStatus: InvitationLinkStatus.FAILED,
          sentAt,
          expiresAt,
          errorCode: 'I502_EMAIL_SEND_FAILED',
          errorMessage: 'Failed to send the invitation email',
        });

        continue;
      }

      /*
       * 이메일 발송 성공:
       * whitelist 상태 갱신과 관리자 로그를 함께 처리한다.
       */
      await this.prisma.$transaction(async (tx) => {
        await tx.whitelistedUser.update({
          where: {
            id: whitelistUserId,
          },
          data: {
            invitationStatus: WhitelistInvitationStatus.INVITED,
            invitedBy: adminId,
            invitedAt: sentAt,
          },
        });

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.INVITATION,
            action: AdminAction.SEND_INVITATION,
            targetId: invitation.id,
            metadata: {
              whitelistUserId,
              email: normalizedEmail,
              expiresAt: expiresAt.toISOString(),
            },
          },
        });
      });

      results.push({
        whitelistUserId,
        email: normalizedEmail,
        invitationId: invitation.id,
        sendStatus: 'SENT',
        invitationStatus: WhitelistInvitationStatus.INVITED,
        linkStatus: InvitationLinkStatus.ACTIVE,
        sentAt,
        expiresAt,
        errorCode: null,
        errorMessage: null,
      });
    }

    return this.buildSummary(results);
  }

  private getSignupUrl(): string {
    const signupUrl = process.env.INVITATION_SIGNUP_URL?.trim();

    if (!signupUrl) {
      throw new ServiceUnavailableException({
        errorCode: 'I503_INVITATION_CONFIG',
        message: 'INVITATION_SIGNUP_URL is not configured',
        data: null,
      });
    }

    try {
      new URL(signupUrl);
    } catch {
      throw new ServiceUnavailableException({
        errorCode: 'I503_INVITATION_CONFIG',
        message: 'INVITATION_SIGNUP_URL is not a valid URL',
        data: null,
      });
    }

    return signupUrl;
  }

  private buildInvitationUrl(signupUrl: string, rawToken: string): string {
    const url = new URL(signupUrl);

    url.searchParams.set('token', rawToken);

    return url.toString();
  }

  private isAllowedEmail(email: string): boolean {
    if (!isEmail(email)) {
      return false;
    }

    const emailParts = email.split('@');

    if (emailParts.length !== 2) {
      return false;
    }

    return emailParts[1] === 'connect.ust.hk';
  }

  private buildSummary(
    results: SendInvitationResult[],
  ): SendInvitationsResponse {
    return {
      requestedCount: results.length,
      sentCount: results.filter((result) => result.sendStatus === 'SENT')
        .length,
      skippedCount: results.filter((result) => result.sendStatus === 'SKIPPED')
        .length,
      failedCount: results.filter((result) => result.sendStatus === 'FAILED')
        .length,
      results,
    };
  }
}
