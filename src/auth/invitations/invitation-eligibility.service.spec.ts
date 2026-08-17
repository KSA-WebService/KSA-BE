import {
  BadRequestException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
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

  it('should reject an invalid invitation token before querying the database', async () => {
    let caughtError: unknown;

    try {
      await service.validate('invalid token!');
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(BadRequestException);

    expect((caughtError as BadRequestException).getResponse()).toEqual({
      errorCode: 'I400_INVALID_INVITATION_TOKEN',
      message: 'The invitation token is invalid',
      data: null,
    });

    expect(invitationFindUniqueMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
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

  it.each([
    {
      name: 'an accepted invitation link',
      linkStatus: InvitationLinkStatus.ACCEPTED,
      invitationStatus: WhitelistInvitationStatus.INVITED,
      userId: null,
    },
    {
      name: 'an accepted whitelist user',
      linkStatus: InvitationLinkStatus.ACTIVE,
      invitationStatus: WhitelistInvitationStatus.ACCEPTED,
      userId: null,
    },
    {
      name: 'a whitelist user already linked to an account',
      linkStatus: InvitationLinkStatus.ACTIVE,
      invitationStatus: WhitelistInvitationStatus.INVITED,
      userId: 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54',
    },
  ])(
    'should reject $name as already accepted',
    async ({ linkStatus, invitationStatus, userId }) => {
      invitationFindUniqueMock.mockResolvedValue({
        id: invitationId,
        whitelistUserId,
        linkStatus,
        expiresAt: futureExpiresAt,
        whitelistUser: {
          ...baseWhitelistUser,
          invitationStatus,
          userId,
        },
      });

      let caughtError: unknown;

      try {
        await service.validate(rawToken);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ConflictException);

      expect((caughtError as ConflictException).getResponse()).toEqual({
        errorCode: 'I409_INVITATION_ALREADY_ACCEPTED',
        message: 'The invitation has already been accepted',
        data: null,
      });

      expect(transactionMock).not.toHaveBeenCalled();
    },
  );

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

  it('should reject a failed invitation as unavailable', async () => {
    invitationFindUniqueMock.mockResolvedValue({
      id: invitationId,
      whitelistUserId,
      linkStatus: InvitationLinkStatus.FAILED,
      expiresAt: futureExpiresAt,
      whitelistUser: baseWhitelistUser,
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

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject an active invitation when the whitelist user is not in invited status', async () => {
    invitationFindUniqueMock.mockResolvedValue({
      id: invitationId,
      whitelistUserId,
      linkStatus: InvitationLinkStatus.ACTIVE,
      expiresAt: futureExpiresAt,
      whitelistUser: {
        ...baseWhitelistUser,
        invitationStatus: WhitelistInvitationStatus.PENDING,
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

  it('should keep the whitelist user invited when another valid active invitation remains', async () => {
    const expiredAt = new Date('2026-08-13T00:00:00.000Z');

    const validInvitationId = 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54';

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

    transactionInvitationFindFirstMock.mockResolvedValue({
      id: validInvitationId,
    });

    await expect(service.validate(rawToken)).rejects.toBeInstanceOf(
      GoneException,
    );

    expect(transactionInvitationUpdateManyMock).toHaveBeenCalledWith({
      where: {
        whitelistUserId,
        linkStatus: InvitationLinkStatus.ACTIVE,
        expiresAt: {
          lte: new Date('2026-08-14T00:00:00.000Z'),
        },
      },
      data: {
        linkStatus: InvitationLinkStatus.EXPIRED,
      },
    });

    expect(transactionInvitationFindFirstMock).toHaveBeenCalledWith({
      where: {
        whitelistUserId,
        linkStatus: InvitationLinkStatus.ACTIVE,
        expiresAt: {
          gt: new Date('2026-08-14T00:00:00.000Z'),
        },
      },
      select: {
        id: true,
      },
    });

    expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
  });
});
