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
  InvitationResendStatusValue,
  InvitationSendStatusValue,
  ResendInvitationResult,
  ResendInvitationsResponse,
  SendInvitationResult,
  SendInvitationsDto,
  SendInvitationsResponse,
} from './dto/send-invitations.dto';
import {
  INVITATION_LINK_STATUS_VALUE_MAP,
  WHITELIST_INVITATION_STATUS_VALUE_MAP,
} from '../../../common/constants/invitation-api-values';

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
          sendStatus: InvitationSendStatusValue.FAILED,
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
          sendStatus: InvitationSendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
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
          sendStatus: InvitationSendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
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
          sendStatus: InvitationSendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
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
          sendStatus: InvitationSendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
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
          sendStatus: InvitationSendStatusValue.FAILED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
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
          idempotencyKey: `invitation/${invitation.id}`,
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
          sendStatus: InvitationSendStatusValue.FAILED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              WhitelistInvitationStatus.FAILED
            ],
          linkStatus:
            INVITATION_LINK_STATUS_VALUE_MAP[InvitationLinkStatus.FAILED],
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
        sendStatus: InvitationSendStatusValue.SENT,
        invitationStatus:
          WHITELIST_INVITATION_STATUS_VALUE_MAP[
            WhitelistInvitationStatus.INVITED
          ],
        linkStatus:
          INVITATION_LINK_STATUS_VALUE_MAP[InvitationLinkStatus.ACTIVE],
        sentAt,
        expiresAt,
        errorCode: null,
        errorMessage: null,
      });
    }

    return this.buildSummary(results);
  }

  async resend(
    dto: SendInvitationsDto,
    adminId: string,
  ): Promise<ResendInvitationsResponse> {
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

    const results: ResendInvitationResult[] = [];

    /*
     * 요청에서 전달된 UUID 순서대로 응답하기 위해
     * 조회 결과가 아닌 dto 배열 순서대로 반복한다.
     */
    for (const whitelistUserId of dto.whitelistUserIds) {
      const whitelistUser = whitelistUserMap.get(whitelistUserId);

      /*
       * UUID 형식은 맞지만 DB에 없는 경우
       */
      if (!whitelistUser) {
        results.push({
          whitelistUserId,
          email: null,
          invitationId: null,
          sendStatus: InvitationResendStatusValue.FAILED,
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
       * 이미 실제 User 계정과 연결된 경우
       */
      if (whitelistUser.userId !== null) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: InvitationResendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_ACCOUNT_ALREADY_LINKED',
          errorMessage: 'The whitelist user is already linked to an account',
        });

        continue;
      }

      /*
       * 가입이 완료된 경우
       */
      if (
        whitelistUser.invitationStatus === WhitelistInvitationStatus.ACCEPTED
      ) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: InvitationResendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_INVITATION_ACCEPTED',
          errorMessage: 'The invitation has already been accepted',
        });

        continue;
      }

      /*
       * 아직 최초 초대를 발송하지 않은 경우
       */
      if (
        whitelistUser.invitationStatus === WhitelistInvitationStatus.PENDING
      ) {
        results.push({
          whitelistUserId,
          email: whitelistUser.email,
          invitationId: null,
          sendStatus: InvitationResendStatusValue.SKIPPED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
          linkStatus: null,
          sentAt: null,
          expiresAt: null,
          errorCode: 'I409_INITIAL_SEND_REQUIRED',
          errorMessage:
            'The initial invitation must be sent through the send API',
        });

        continue;
      }

      /*
       * 아래 상태만 재발송할 수 있다.
       *
       * INVITED
       * EXPIRED
       * FAILED
       */

      const normalizedEmail = whitelistUser.email.trim().toLowerCase();

      /*
       * 잘못된 이메일은 Invitation을 만들기 전에 차단한다.
       */
      if (!this.isAllowedEmail(normalizedEmail)) {
        results.push({
          whitelistUserId,
          email: normalizedEmail,
          invitationId: null,
          sendStatus: InvitationResendStatusValue.FAILED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
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
       * 이메일 링크에 포함할 원본 토큰
       */
      const rawToken = randomBytes(32).toString('base64url');

      /*
       * DB에는 원본 토큰이 아닌 SHA-256 해시만 저장한다.
       */
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      const invitationUrl = this.buildInvitationUrl(signupUrl, rawToken);

      /*
       * 기존 ACTIVE 링크는 아직 폐기하지 않는다.
       *
       * 새 메일 발송이 실패할 수 있으므로
       * 메일 발송 성공 이후에만 기존 링크를 REVOKED 처리한다.
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
          idempotencyKey: `invitation/${invitation.id}`,
        });
      } catch {
        /*
         * 재발송 실패:
         *
         * 새 Invitation만 FAILED로 변경한다.
         * 기존 ACTIVE 링크는 그대로 유지한다.
         * WhitelistedUser 상태도 변경하지 않는다.
         */
        await this.prisma.invitation.update({
          where: {
            id: invitation.id,
          },
          data: {
            linkStatus: InvitationLinkStatus.FAILED,
          },
        });

        results.push({
          whitelistUserId,
          email: normalizedEmail,
          invitationId: invitation.id,
          sendStatus: InvitationResendStatusValue.FAILED,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              whitelistUser.invitationStatus
            ],
          linkStatus:
            INVITATION_LINK_STATUS_VALUE_MAP[InvitationLinkStatus.FAILED],
          sentAt,
          expiresAt,
          errorCode: 'I502_EMAIL_RESEND_FAILED',
          errorMessage: 'Failed to resend the invitation email',
        });

        continue;
      }

      /*
       * 메일 발송에 성공한 경우에만:
       *
       * 1. 기존 ACTIVE 링크를 REVOKED 처리
       * 2. whitelist 상태를 INVITED로 갱신
       * 3. 관리자 로그 생성
       */
      await this.prisma.$transaction(async (tx) => {
        const previousActiveInvitations = await tx.invitation.findMany({
          where: {
            whitelistUserId,
            id: {
              not: invitation.id,
            },
            linkStatus: InvitationLinkStatus.ACTIVE,
          },
          select: {
            id: true,
          },
        });

        const revokedInvitationIds = previousActiveInvitations.map(
          (previousInvitation) => previousInvitation.id,
        );

        if (revokedInvitationIds.length > 0) {
          await tx.invitation.updateMany({
            where: {
              id: {
                in: revokedInvitationIds,
              },
              linkStatus: InvitationLinkStatus.ACTIVE,
            },
            data: {
              linkStatus: InvitationLinkStatus.REVOKED,
            },
          });
        }

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
            action: AdminAction.RESEND_INVITATION,
            targetId: invitation.id,
            metadata: {
              whitelistUserId,
              email: normalizedEmail,
              expiresAt: expiresAt.toISOString(),
              revokedInvitationIds,
            },
          },
        });
      });

      results.push({
        whitelistUserId,
        email: normalizedEmail,
        invitationId: invitation.id,
        sendStatus: InvitationResendStatusValue.RESENT,
        invitationStatus:
          WHITELIST_INVITATION_STATUS_VALUE_MAP[
            WhitelistInvitationStatus.INVITED
          ],
        linkStatus:
          INVITATION_LINK_STATUS_VALUE_MAP[InvitationLinkStatus.ACTIVE],
        sentAt,
        expiresAt,
        errorCode: null,
        errorMessage: null,
      });
    }

    return this.buildResendSummary(results);
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
      sentCount: results.filter(
        (result) => result.sendStatus === InvitationSendStatusValue.SENT,
      ).length,
      skippedCount: results.filter(
        (result) => result.sendStatus === InvitationSendStatusValue.SKIPPED,
      ).length,
      failedCount: results.filter(
        (result) => result.sendStatus === InvitationSendStatusValue.FAILED,
      ).length,
      results,
    };
  }

  private buildResendSummary(
    results: ResendInvitationResult[],
  ): ResendInvitationsResponse {
    return {
      requestedCount: results.length,
      resentCount: results.filter(
        (result) => result.sendStatus === InvitationResendStatusValue.RESENT,
      ).length,
      skippedCount: results.filter(
        (result) => result.sendStatus === InvitationResendStatusValue.SKIPPED,
      ).length,
      failedCount: results.filter(
        (result) => result.sendStatus === InvitationResendStatusValue.FAILED,
      ).length,
      results,
    };
  }
}
