import { ConflictException, GoneException } from '@nestjs/common';
import { WhitelistInvitationStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InvitationEligibilityService } from './invitation-eligibility.service';
import { InvitationVerificationService } from './invitation-verification.service';

describe('InvitationVerificationService', () => {
  let service: InvitationVerificationService;

  const userFindFirstMock = jest.fn();

  const prismaServiceMock = {
    user: {
      findFirst: userFindFirstMock,
    },
  };

  const invitationValidateMock = jest.fn();

  const invitationEligibilityServiceMock = {
    validate: invitationValidateMock,
  };

  const whitelistUserId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const invitationId = 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54';

  const expiresAt = new Date('2026-08-20T00:00:00.000Z');

  const eligibleInvitation = {
    invitationId,
    whitelistUserId,
    expiresAt,
    whitelistUser: {
      id: whitelistUserId,
      name: 'HKUST Student',
      email: 'student@connect.ust.hk',
      studentNumber: '20912345',
      userId: null,
      invitationStatus: WhitelistInvitationStatus.INVITED,
    },
  };

  const dto = {
    token: 'valid_test_token_123',
  };

  beforeEach(() => {
    jest.resetAllMocks();

    service = new InvitationVerificationService(
      prismaServiceMock as unknown as PrismaService,
      invitationEligibilityServiceMock as unknown as InvitationEligibilityService,
    );
  });

  it('should return signup information for an eligible invitation', async () => {
    invitationValidateMock.mockResolvedValue(eligibleInvitation);

    userFindFirstMock.mockResolvedValue(null);

    const result = await service.verify(dto);

    expect(invitationValidateMock).toHaveBeenCalledWith(dto.token);

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            email: {
              equals: eligibleInvitation.whitelistUser.email,
              mode: 'insensitive',
            },
          },
          {
            studentNumber: eligibleInvitation.whitelistUser.studentNumber,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    expect(result).toEqual({
      name: eligibleInvitation.whitelistUser.name,
      email: eligibleInvitation.whitelistUser.email,
      studentNumber: eligibleInvitation.whitelistUser.studentNumber,
      expiresAt: expiresAt.toISOString(),
    });
  });

  it('should reject verification when a user already exists with the same email', async () => {
    invitationValidateMock.mockResolvedValue(eligibleInvitation);

    userFindFirstMock.mockResolvedValue({
      id: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
    });

    let caughtError: unknown;

    try {
      await service.verify(dto);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(ConflictException);

    expect((caughtError as ConflictException).getResponse()).toEqual({
      errorCode: 'I409_INVITATION_ALREADY_ACCEPTED',
      message: 'The invitation has already been accepted',
      data: null,
    });
  });

  it('should reject verification when a user already exists with the same student number', async () => {
    invitationValidateMock.mockResolvedValue(eligibleInvitation);

    /*
     * Prisma query는 email / studentNumber를 OR로 조회하므로
     * 서비스 관점에서는 어떤 필드가 일치했는지와 관계없이
     * existingUser가 존재하면 동일하게 가입을 차단한다.
     */
    userFindFirstMock.mockResolvedValue({
      id: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
    });

    await expect(service.verify(dto)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'I409_INVITATION_ALREADY_ACCEPTED',
        message: 'The invitation has already been accepted',
        data: null,
      },
    });

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            email: {
              equals: eligibleInvitation.whitelistUser.email,
              mode: 'insensitive',
            },
          },
          {
            studentNumber: eligibleInvitation.whitelistUser.studentNumber,
          },
        ],
      },
      select: {
        id: true,
      },
    });
  });

  it('should propagate invitation eligibility errors without querying users', async () => {
    invitationValidateMock.mockRejectedValue(
      new GoneException({
        errorCode: 'I410_INVITATION_REVOKED',
        message: 'This invitation link is no longer valid',
        data: null,
      }),
    );

    await expect(service.verify(dto)).rejects.toMatchObject({
      status: 410,
      response: {
        errorCode: 'I410_INVITATION_REVOKED',
        message: 'This invitation link is no longer valid',
        data: null,
      },
    });

    expect(userFindFirstMock).not.toHaveBeenCalled();
  });
});
