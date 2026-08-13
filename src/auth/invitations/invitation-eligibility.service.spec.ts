import { GoneException } from '@nestjs/common';
import {
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';
import { createHash } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { InvitationEligibilityService } from './invitation-eligibility.service';

describe('InvitationEligibilityService', () => {
  let service: InvitationEligibilityService;

  const invitationFindUniqueMock = jest.fn();

  const transactionInvitationUpdateManyMock = jest.fn();
  const transactionInvitationFindFirstMock = jest.fn();
  const transactionWhitelistUserUpdateManyMock = jest.fn();

  const transactionClientMock = {
    invitation: {
      updateMany: transactionInvitationUpdateManyMock,
      findFirst: transactionInvitationFindFirstMock,
    },
    whitelistedUser: {
      updateMany: transactionWhitelistUserUpdateManyMock,
    },
  };

  const transactionMock = jest.fn();

  const prismaServiceMock = {
    invitation: {
      findUnique: invitationFindUniqueMock,
    },
    $transaction: transactionMock,
  };

  const rawToken = 'valid_test_token_123';

  const tokenHash = createHash('sha256').update(rawToken).digest('hex');

  const invitationId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const whitelistUserId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const futureExpiresAt = new Date('2026-08-20T00:00:00.000Z');

  const baseWhitelistUser = {
    id: whitelistUserId,
    name: 'HKUST Student',
    email: 'student@connect.ust.hk',
    studentNumber: '20912345',
    userId: null,
    invitationStatus: WhitelistInvitationStatus.INVITED,
    deletedAt: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-14T00:00:00.000Z'));

    transactionMock.mockImplementation(
      async (
        callback: (tx: typeof transactionClientMock) => Promise<unknown>,
      ) => callback(transactionClientMock),
    );

    service = new InvitationEligibilityService(
      prismaServiceMock as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return an eligible active invitation for an active whitelist user', async () => {
    invitationFindUniqueMock.mockResolvedValue({
      id: invitationId,
      whitelistUserId,
      linkStatus: InvitationLinkStatus.ACTIVE,
      expiresAt: futureExpiresAt,
      whitelistUser: baseWhitelistUser,
    });

    const result = await service.validate(rawToken);

    expect(invitationFindUniqueMock).toHaveBeenCalledWith({
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

    expect(result).toEqual({
      invitationId,
      whitelistUserId,
      expiresAt: futureExpiresAt,
      whitelistUser: baseWhitelistUser,
    });
  });

  it('should reject an active invitation when the whitelist user is soft-deleted', async () => {
    invitationFindUniqueMock.mockResolvedValue({
      id: invitationId,
      whitelistUserId,
      linkStatus: InvitationLinkStatus.ACTIVE,
      expiresAt: futureExpiresAt,
      whitelistUser: {
        ...baseWhitelistUser,
        deletedAt: new Date('2026-08-13T00:00:00.000Z'),
      },
    });

    let caughtError: unknown;

    try {
      await service.validate(rawToken);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(GoneException);

    expect((caughtError as GoneException).getResponse()).toEqual({
      errorCode: 'I410_INVITATION_UNAVAILABLE',
      message: 'This invitation is unavailable',
      data: null,
    });
  });

  it('should preserve the revoked error for a soft-deleted whitelist user whose invitation was revoked', async () => {
    invitationFindUniqueMock.mockResolvedValue({
      id: invitationId,
      whitelistUserId,
      linkStatus: InvitationLinkStatus.REVOKED,
      expiresAt: futureExpiresAt,
      whitelistUser: {
        ...baseWhitelistUser,
        deletedAt: new Date('2026-08-13T00:00:00.000Z'),
      },
    });

    let caughtError: unknown;

    try {
      await service.validate(rawToken);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(GoneException);

    expect((caughtError as GoneException).getResponse()).toEqual({
      errorCode: 'I410_INVITATION_REVOKED',
      message: 'This invitation link is no longer valid',
      data: null,
    });
  });

  it('should only expire an active non-deleted whitelist user when no valid invitation remains', async () => {
    const expiredAt = new Date('2026-08-13T00:00:00.000Z');

    invitationFindUniqueMock.mockResolvedValue({
      id: invitationId,
      whitelistUserId,
      linkStatus: InvitationLinkStatus.ACTIVE,
      expiresAt: expiredAt,
      whitelistUser: baseWhitelistUser,
    });

    transactionInvitationUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    transactionInvitationFindFirstMock.mockResolvedValue(null);

    transactionWhitelistUserUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    await expect(service.validate(rawToken)).rejects.toBeInstanceOf(
      GoneException,
    );

    expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
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
});
