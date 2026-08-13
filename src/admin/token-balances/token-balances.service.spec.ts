import 'reflect-metadata';
import {
  AdminAction,
  AdminActionType,
  Prisma,
  TokenTransactionType,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenBalancesService } from './token-balances.service';

describe('TokenBalancesService', () => {
  let service: TokenBalancesService;

  const userAggregateMock = jest.fn();
  const userFindUniqueMock = jest.fn();
  const userFindManyMock = jest.fn();
  const userUpdateManyMock = jest.fn();
  const tokenLogCreateManyMock = jest.fn();
  const adminActionLogCreateMock = jest.fn();

  const transactionClientMock = {
    user: {
      findUnique: userFindUniqueMock,
      findMany: userFindManyMock,
      updateMany: userUpdateManyMock,
    },
    tokenLog: {
      createMany: tokenLogCreateManyMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
  };

  const prismaServiceMock = {
    user: {
      aggregate: userAggregateMock,
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prismaServiceMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof transactionClientMock) => Promise<unknown>,
      ) => callback(transactionClientMock),
    );

    service = new TokenBalancesService(
      prismaServiceMock as unknown as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the reset target count and total token amount', async () => {
    userAggregateMock.mockResolvedValue({
      _count: {
        _all: 35,
      },
      _sum: {
        tokenBalance: 142,
      },
    });

    const result = await service.getResetPreview();

    expect(result.affectedMemberCount).toBe(35);
    expect(result.totalResetAmount).toBe(142);
    expect(result.previewedAt).toBeInstanceOf(Date);

    expect(userAggregateMock).toHaveBeenCalledWith({
      where: {
        role: UserRole.STUDENT,
        deletedAt: null,
        tokenBalance: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        tokenBalance: true,
      },
    });
  });

  it('should return zero preview values when no student has a positive balance', async () => {
    userAggregateMock.mockResolvedValue({
      _count: {
        _all: 0,
      },
      _sum: {
        tokenBalance: null,
      },
    });

    const result = await service.getResetPreview();

    expect(result.affectedMemberCount).toBe(0);
    expect(result.totalResetAmount).toBe(0);
  });

  it('should reset all positive student balances and create audit logs', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const firstUserId = 'a8d91c2e-2222-4a11-9f10-abc123456789';

    const secondUserId = 'c7d82b1f-3333-4a11-9f10-abc123456789';

    const performedAt = new Date('2026-08-03T04:00:00.000Z');

    userFindUniqueMock.mockResolvedValue({
      id: adminId,
      name: 'Sulynn Kim',
    });

    userFindManyMock.mockResolvedValue([
      {
        id: firstUserId,
        tokenBalance: 5,
      },
      {
        id: secondUserId,
        tokenBalance: 3,
      },
    ]);

    tokenLogCreateManyMock.mockResolvedValue({
      count: 2,
    });

    userUpdateManyMock.mockResolvedValue({
      count: 2,
    });

    adminActionLogCreateMock.mockResolvedValue({
      createdAt: performedAt,
    });

    await expect(
      service.resetTokenBalances(
        {
          reason: '  End of Spring 2026 semester  ',
          confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
        },
        adminId,
      ),
    ).resolves.toEqual({
      affectedMemberCount: 2,
      totalResetAmount: 8,
      reason: 'End of Spring 2026 semester',
      performedBy: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      performedAt,
    });

    expect(userFindManyMock).toHaveBeenCalledWith({
      where: {
        role: UserRole.STUDENT,
        deletedAt: null,
        tokenBalance: {
          gt: 0,
        },
      },
      select: {
        id: true,
        tokenBalance: true,
      },
      orderBy: {
        id: 'asc',
      },
    });

    expect(tokenLogCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          transactionType: TokenTransactionType.RESET,
          adminId,
          userId: firstUserId,
          balanceBefore: 5,
          balanceAfter: 0,
          delta: -5,
          reason: 'End of Spring 2026 semester',
        },
        {
          transactionType: TokenTransactionType.RESET,
          adminId,
          userId: secondUserId,
          balanceBefore: 3,
          balanceAfter: 0,
          delta: -3,
          reason: 'End of Spring 2026 semester',
        },
      ],
    });

    expect(userUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: {
          in: [firstUserId, secondUserId],
        },
        role: UserRole.STUDENT,
        deletedAt: null,
        tokenBalance: {
          gt: 0,
        },
      },
      data: {
        tokenBalance: 0,
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.TOKEN,
        action: AdminAction.RESET_TOKEN_BALANCES,
        targetId: null,
        metadata: {
          affectedMemberCount: 2,
          totalResetAmount: 8,
          reason: 'End of Spring 2026 semester',
        },
      },
      select: {
        createdAt: true,
      },
    });
  });

  it('should succeed without creating logs when no balance needs resetting', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    userFindUniqueMock.mockResolvedValue({
      id: adminId,
      name: 'Sulynn Kim',
    });

    userFindManyMock.mockResolvedValue([]);

    const result = await service.resetTokenBalances(
      {
        reason: 'End of Spring 2026 semester',
        confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
      },
      adminId,
    );

    expect(result).toMatchObject({
      affectedMemberCount: 0,
      totalResetAmount: 0,
      reason: 'End of Spring 2026 semester',
      performedBy: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
    });

    expect(result.performedAt).toBeInstanceOf(Date);

    expect(tokenLogCreateManyMock).not.toHaveBeenCalled();

    expect(userUpdateManyMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an invalid confirmation phrase', async () => {
    await expect(
      service.resetTokenBalances(
        {
          reason: 'End of Spring 2026 semester',
          confirmation: 'RESET',
        },
        'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'T400_INVALID_RESET_CONFIRMATION',
        message: 'Reset confirmation phrase does not match',
      },
    });

    expect(prismaServiceMock.$transaction).not.toHaveBeenCalled();
  });

  it('should reject the reset when a target becomes unavailable before the final update', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    userFindUniqueMock.mockResolvedValue({
      id: adminId,
      name: 'Sulynn Kim',
    });

    userFindManyMock.mockResolvedValue([
      {
        id: 'a8d91c2e-2222-4a11-9f10-abc123456789',
        tokenBalance: 5,
      },
      {
        id: 'c7d82b1f-3333-4a11-9f10-abc123456789',
        tokenBalance: 3,
      },
    ]);

    tokenLogCreateManyMock.mockResolvedValue({
      count: 2,
    });

    userUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    await expect(
      service.resetTokenBalances(
        {
          reason: 'End of Spring 2026 semester',
          confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'T409_TOKEN_BALANCE_RESET_CONFLICT',
        message: 'Token balances changed while the reset was being processed',
      },
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();

    expect(tokenLogCreateManyMock).not.toHaveBeenCalled();

    expect(userUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: {
          in: [
            'a8d91c2e-2222-4a11-9f10-abc123456789',
            'c7d82b1f-3333-4a11-9f10-abc123456789',
          ],
        },
        role: UserRole.STUDENT,
        deletedAt: null,
        tokenBalance: {
          gt: 0,
        },
      },
      data: {
        tokenBalance: 0,
      },
    });
  });

  it('should retry a P2034 transaction conflict', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const conflictError = new Prisma.PrismaClientKnownRequestError(
      'Transaction conflict',
      {
        code: 'P2034',
        clientVersion: 'test',
      },
    );

    prismaServiceMock.$transaction
      .mockRejectedValueOnce(conflictError)
      .mockRejectedValueOnce(conflictError);

    userFindUniqueMock.mockResolvedValue({
      id: adminId,
      name: 'Sulynn Kim',
    });

    userFindManyMock.mockResolvedValue([]);

    await expect(
      service.resetTokenBalances(
        {
          reason: 'End of Spring 2026 semester',
          confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
        },
        adminId,
      ),
    ).resolves.toMatchObject({
      affectedMemberCount: 0,
      totalResetAmount: 0,
    });

    expect(prismaServiceMock.$transaction).toHaveBeenCalledTimes(3);

    expect(prismaServiceMock.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  });
});
