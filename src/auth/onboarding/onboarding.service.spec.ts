import { GoneException } from '@nestjs/common';
import {
  InvitationLinkStatus,
  UserRole,
  UserStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InvitationEligibilityService } from '../invitations/invitation-eligibility.service';
import { SupabaseAdminService } from '../supabase-admin.service';
import { OnboardingService } from './onboarding.service';

describe('OnboardingService', () => {
  let service: OnboardingService;

  const userFindFirstMock = jest.fn();

  const transactionUserCreateMock = jest.fn();
  const transactionInvitationUpdateManyMock = jest.fn();
  const transactionWhitelistUserUpdateManyMock = jest.fn();

  const transactionClientMock = {
    user: {
      create: transactionUserCreateMock,
    },
    invitation: {
      updateMany: transactionInvitationUpdateManyMock,
    },
    whitelistedUser: {
      updateMany: transactionWhitelistUserUpdateManyMock,
    },
  };

  const transactionMock = jest.fn();

  const prismaServiceMock = {
    user: {
      findFirst: userFindFirstMock,
    },
    $transaction: transactionMock,
  };

  const invitationValidateMock = jest.fn();

  const invitationEligibilityServiceMock = {
    validate: invitationValidateMock,
  };

  const createConfirmedUserMock = jest.fn();
  const deleteUserMock = jest.fn();

  const supabaseAdminServiceMock = {
    createConfirmedUser: createConfirmedUserMock,
    deleteUser: deleteUserMock,
  };

  const authUserId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const whitelistUserId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const invitationId = 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54';

  const expiresAt = new Date('2026-08-20T00:00:00.000Z');

  const createdAt = new Date('2026-08-14T00:00:00.000Z');

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
    password: 'StrongPassword1!',
    agreedPrivacy: true,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-14T03:00:00.000Z'));

    transactionMock.mockImplementation(
      async (
        callback: (tx: typeof transactionClientMock) => Promise<unknown>,
      ) => callback(transactionClientMock),
    );

    service = new OnboardingService(
      prismaServiceMock as unknown as PrismaService,
      invitationEligibilityServiceMock as unknown as InvitationEligibilityService,
      supabaseAdminServiceMock as unknown as SupabaseAdminService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should complete onboarding when the whitelist user is still active', async () => {
    invitationValidateMock.mockResolvedValue(eligibleInvitation);

    userFindFirstMock.mockResolvedValue(null);

    createConfirmedUserMock.mockResolvedValue({
      id: authUserId,
    });

    transactionUserCreateMock.mockResolvedValue({
      id: authUserId,
      name: eligibleInvitation.whitelistUser.name,
      email: eligibleInvitation.whitelistUser.email,
      studentNumber: eligibleInvitation.whitelistUser.studentNumber,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      tokenBalance: 0,
      createdAt,
    });

    transactionInvitationUpdateManyMock
      .mockResolvedValueOnce({
        count: 1,
      })
      .mockResolvedValueOnce({
        count: 0,
      });

    transactionWhitelistUserUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    const result = await service.complete(dto);

    expect(invitationValidateMock).toHaveBeenCalledTimes(1);
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

    expect(createConfirmedUserMock).toHaveBeenCalledWith(
      eligibleInvitation.whitelistUser.email,
      dto.password,
    );

    expect(transactionUserCreateMock).toHaveBeenCalledWith({
      data: {
        id: authUserId,
        name: eligibleInvitation.whitelistUser.name,
        email: eligibleInvitation.whitelistUser.email,
        studentNumber: eligibleInvitation.whitelistUser.studentNumber,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        tokenBalance: 0,
        agreedPrivacy: true,
        agreedAt: expect.any(Date) as unknown,
      },
      select: {
        id: true,
        name: true,
        email: true,
        studentNumber: true,
        role: true,
        status: true,
        tokenBalance: true,
        createdAt: true,
      },
    });

    expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: whitelistUserId,
        deletedAt: null,
        userId: null,
        invitationStatus: WhitelistInvitationStatus.INVITED,
      },
      data: {
        userId: authUserId,
        invitationStatus: WhitelistInvitationStatus.ACCEPTED,
        acceptedAt: expect.any(Date) as unknown,
      },
    });

    expect(transactionInvitationUpdateManyMock).toHaveBeenNthCalledWith(1, {
      where: {
        id: invitationId,
        whitelistUserId,
        linkStatus: InvitationLinkStatus.ACTIVE,
        expiresAt: {
          gt: expect.any(Date) as unknown,
        },
      },
      data: {
        linkStatus: InvitationLinkStatus.ACCEPTED,
        acceptedAt: expect.any(Date) as unknown,
      },
    });

    expect(transactionInvitationUpdateManyMock).toHaveBeenNthCalledWith(2, {
      where: {
        whitelistUserId,
        id: {
          not: invitationId,
        },
        linkStatus: InvitationLinkStatus.ACTIVE,
      },
      data: {
        linkStatus: InvitationLinkStatus.REVOKED,
      },
    });

    expect(deleteUserMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      userId: authUserId,
      name: eligibleInvitation.whitelistUser.name,
      email: eligibleInvitation.whitelistUser.email,
      studentNumber: eligibleInvitation.whitelistUser.studentNumber,
      role: 'student',
      status: 'active',
      tokenBalance: 0,
      createdAt: createdAt.toISOString(),
    });
  });

  it('should compensate the Supabase Auth user when the whitelist user is deleted during onboarding', async () => {
    invitationValidateMock
      .mockResolvedValueOnce(eligibleInvitation)
      .mockRejectedValueOnce(
        new GoneException({
          errorCode: 'I410_INVITATION_REVOKED',
          message: 'This invitation link is no longer valid',
          data: null,
        }),
      );

    userFindFirstMock.mockResolvedValue(null);

    createConfirmedUserMock.mockResolvedValue({
      id: authUserId,
    });

    transactionUserCreateMock.mockResolvedValue({
      id: authUserId,
      name: eligibleInvitation.whitelistUser.name,
      email: eligibleInvitation.whitelistUser.email,
      studentNumber: eligibleInvitation.whitelistUser.studentNumber,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      tokenBalance: 0,
      createdAt,
    });

    /*
     * Invitation은 transaction 시작 시점에는 아직 ACTIVE였다고 가정한다.
     * 이후 whitelist conditional update에서 soft delete를 감지한다.
     */
    transactionInvitationUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    transactionWhitelistUserUpdateManyMock.mockResolvedValue({
      count: 0,
    });

    deleteUserMock.mockResolvedValue(undefined);

    let caughtError: unknown;

    try {
      await service.complete(dto);
    } catch (error: unknown) {
      caughtError = error;
    }

    expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: whitelistUserId,
        deletedAt: null,
        userId: null,
        invitationStatus: WhitelistInvitationStatus.INVITED,
      },
      data: {
        userId: authUserId,
        invitationStatus: WhitelistInvitationStatus.ACCEPTED,
        acceptedAt: expect.any(Date) as unknown,
      },
    });

    /*
     * DB activation이 실패했으므로
     * 이번 요청에서 만든 Supabase Auth user를 제거해야 한다.
     */
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith(authUserId);

    /*
     * 초기 validate + state change 후 최신 상태 재검증
     */
    expect(invitationValidateMock).toHaveBeenCalledTimes(2);

    expect(caughtError).toBeInstanceOf(GoneException);

    expect((caughtError as GoneException).getResponse()).toEqual({
      errorCode: 'I410_INVITATION_REVOKED',
      message: 'This invitation link is no longer valid',
      data: null,
    });
  });

  it('should reject onboarding when a KSA user already exists', async () => {
    invitationValidateMock.mockResolvedValue(eligibleInvitation);

    userFindFirstMock.mockResolvedValue({
      id: 'c5b922c5-9ca5-4c29-81e6-8faec8fbda56',
    });

    await expect(service.complete(dto)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'A409_ACCOUNT_ALREADY_EXISTS',
        message: 'An account already exists for this user',
        data: null,
      },
    });

    expect(createConfirmedUserMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('should stop onboarding when invitation eligibility validation fails', async () => {
    invitationValidateMock.mockRejectedValue(
      new GoneException({
        errorCode: 'I410_INVITATION_REVOKED',
        message: 'This invitation link is no longer valid',
        data: null,
      }),
    );

    await expect(service.complete(dto)).rejects.toMatchObject({
      status: 410,
      response: {
        errorCode: 'I410_INVITATION_REVOKED',
        message: 'This invitation link is no longer valid',
        data: null,
      },
    });

    expect(userFindFirstMock).not.toHaveBeenCalled();
    expect(createConfirmedUserMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(deleteUserMock).not.toHaveBeenCalled();
  });
});
