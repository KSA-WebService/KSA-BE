import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
} from '@nestjs/common';
import {
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VerifyInvitationDto,
  VerifyInvitationResponse,
} from './dto/verify-invitation.dto';

@Injectable()
export class InvitationVerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async verify(dto: VerifyInvitationDto): Promise<VerifyInvitationResponse> {
    const rawToken = this.normalizeAndValidateToken(dto.token);

    /*
     * 초대 발송 시와 동일하게 SHA-256 해시를 생성한다.
     *
     * DB에는 원본 토큰이 아니라 tokenHash만 저장되어 있으므로,
     * 요청으로 받은 원본 토큰을 해시한 뒤 조회해야 한다.
     */
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    const invitation = await this.prisma.invitation.findUnique({
      where: {
        tokenHash,
      },
      select: {
        id: true,
        whitelistUserId: true,
        linkStatus: true,
        expiresAt: true,
        whitelistUser: {
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            userId: true,
            invitationStatus: true,
          },
        },
      },
    });

    /*
     * 존재하지 않는 토큰은 토큰 존재 여부를 외부에 노출하지 않도록
     * 404가 아닌 잘못된 토큰 오류로 반환한다.
     */
    if (!invitation) {
      throw this.invalidTokenException();
    }

    const whitelistUser = invitation.whitelistUser;

    /*
     * userId 연결 여부뿐 아니라 동일 이메일의 User 존재 여부도 확인한다.
     *
     * 데이터 연결 과정에서 오류가 발생해 whitelistUser.userId가 null이지만
     * User 계정만 생성된 경우의 중복 가입을 차단하기 위한 검사다.
     */
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: whitelistUser.email,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
      },
    });

    /*
     * 계정이 이미 생성되었거나 초대가 이미 수락된 경우
     */
    if (
      invitation.linkStatus === InvitationLinkStatus.ACCEPTED ||
      whitelistUser.invitationStatus === WhitelistInvitationStatus.ACCEPTED ||
      whitelistUser.userId !== null ||
      existingUser !== null
    ) {
      throw new ConflictException({
        errorCode: 'I409_INVITATION_ALREADY_ACCEPTED',
        message: 'The invitation has already been accepted',
        data: null,
      });
    }

    /*
     * 재발송으로 인해 폐기된 이전 링크
     */
    if (invitation.linkStatus === InvitationLinkStatus.REVOKED) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_REVOKED',
        message: 'This invitation link is no longer valid',
        data: null,
      });
    }

    /*
     * 이메일 발송에 실패했거나 사용할 수 없는 링크
     */
    if (invitation.linkStatus === InvitationLinkStatus.FAILED) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    const now = new Date();

    /*
     * DB 상태가 이미 EXPIRED이거나 실제 만료 시각이 지난 경우
     */
    if (
      invitation.linkStatus === InvitationLinkStatus.EXPIRED ||
      invitation.expiresAt <= now
    ) {
      await this.markExpiredInvitations(invitation.whitelistUserId, now);

      throw new GoneException({
        errorCode: 'I410_INVITATION_EXPIRED',
        message: 'The invitation link has expired',
        data: null,
      });
    }

    /*
     * 위에서 처리되지 않은 비정상 링크 상태
     */
    if (invitation.linkStatus !== InvitationLinkStatus.ACTIVE) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    /*
     * ACTIVE 링크라 하더라도 WhitelistedUser가 INVITED 상태가 아니면
     * 계정 활성화를 허용하지 않는다.
     */
    if (whitelistUser.invitationStatus !== WhitelistInvitationStatus.INVITED) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    return {
      name: whitelistUser.name,
      email: whitelistUser.email,
      studentNumber: whitelistUser.studentNumber,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /*
   * 원본 초대 토큰 형식 검증
   *
   * 현재 발송 로직은 randomBytes(32).toString('base64url')을 사용하므로
   * 영문자, 숫자, 밑줄, 하이픈만 허용한다.
   */
  private normalizeAndValidateToken(token: unknown): string {
    if (typeof token !== 'string') {
      throw this.invalidTokenException();
    }

    const normalizedToken = token.trim();

    if (
      normalizedToken.length === 0 ||
      normalizedToken.length > 255 ||
      !/^[A-Za-z0-9_-]+$/.test(normalizedToken)
    ) {
      throw this.invalidTokenException();
    }

    return normalizedToken;
  }

  private invalidTokenException(): BadRequestException {
    return new BadRequestException({
      errorCode: 'I400_INVALID_INVITATION_TOKEN',
      message: 'The invitation token is invalid',
      data: null,
    });
  }

  /*
   * 실제 만료 시각이 지난 ACTIVE Invitation들을 EXPIRED로 변경한다.
   *
   * 같은 WhitelistedUser에게 아직 유효한 다른 ACTIVE 초대가 있다면
   * WhitelistedUser의 상태는 INVITED로 유지한다.
   *
   * 유효한 ACTIVE 초대가 하나도 없을 때만
   * WhitelistedUser.invitationStatus를 EXPIRED로 변경한다.
   */
  private async markExpiredInvitations(
    whitelistUserId: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          whitelistUserId,
          linkStatus: InvitationLinkStatus.ACTIVE,
          expiresAt: {
            lte: now,
          },
        },
        data: {
          linkStatus: InvitationLinkStatus.EXPIRED,
        },
      });

      const validActiveInvitation = await tx.invitation.findFirst({
        where: {
          whitelistUserId,
          linkStatus: InvitationLinkStatus.ACTIVE,
          expiresAt: {
            gt: now,
          },
        },
        select: {
          id: true,
        },
      });

      if (validActiveInvitation) {
        return;
      }

      await tx.whitelistedUser.updateMany({
        where: {
          id: whitelistUserId,
          userId: null,
          invitationStatus: WhitelistInvitationStatus.INVITED,
        },
        data: {
          invitationStatus: WhitelistInvitationStatus.EXPIRED,
        },
      });
    });
  }
}
