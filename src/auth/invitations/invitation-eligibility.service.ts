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

export interface EligibleInvitation {
  invitationId: string;
  whitelistUserId: string;
  expiresAt: Date;
  whitelistUser: {
    id: string;
    name: string;
    email: string;
    studentNumber: string;
    userId: string | null;
    invitationStatus: WhitelistInvitationStatus;
  };
}

@Injectable()
export class InvitationEligibilityService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(token: unknown): Promise<EligibleInvitation> {
    const rawToken = this.normalizeAndValidateToken(token);
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
            deletedAt: true,
          },
        },
      },
    });

    if (!invitation) {
      throw this.invalidTokenException();
    }

    const whitelistUser = invitation.whitelistUser;

    if (
      invitation.linkStatus === InvitationLinkStatus.ACCEPTED ||
      whitelistUser.invitationStatus === WhitelistInvitationStatus.ACCEPTED ||
      whitelistUser.userId !== null
    ) {
      throw new ConflictException({
        errorCode: 'I409_INVITATION_ALREADY_ACCEPTED',
        message: 'The invitation has already been accepted',
        data: null,
      });
    }

    if (invitation.linkStatus === InvitationLinkStatus.REVOKED) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_REVOKED',
        message: 'This invitation link is no longer valid',
        data: null,
      });
    }

    if (invitation.linkStatus === InvitationLinkStatus.FAILED) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    if (whitelistUser.deletedAt !== null) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    const now = new Date();

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

    if (invitation.linkStatus !== InvitationLinkStatus.ACTIVE) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    if (whitelistUser.invitationStatus !== WhitelistInvitationStatus.INVITED) {
      throw new GoneException({
        errorCode: 'I410_INVITATION_UNAVAILABLE',
        message: 'This invitation is unavailable',
        data: null,
      });
    }

    return {
      invitationId: invitation.id,
      whitelistUserId: invitation.whitelistUserId,
      expiresAt: invitation.expiresAt,
      whitelistUser,
    };
  }

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
          deletedAt: null,
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
