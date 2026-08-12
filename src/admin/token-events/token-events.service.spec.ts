import 'reflect-metadata';
import {
  AdminAction,
  AdminActionType,
  Prisma,
  TokenTransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { TokenGrantStatusFilter } from './dto/get-token-event-detail-query.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenEventsService } from './token-events.service';

describe('TokenEventsService', () => {
  let service: TokenEventsService;

  const tokenEventCreateMock = jest.fn();
  const adminActionLogCreateMock = jest.fn();
  const tokenGrantCreateMock = jest.fn();
  const tokenLogCreateMock = jest.fn();
  const tokenEventFindManyMock = jest.fn();
  const tokenEventCountMock = jest.fn();
  const tokenGrantGroupByMock = jest.fn();
  const tokenEventFindFirstMock = jest.fn();
  const userFindManyMock = jest.fn();
  const userCountMock = jest.fn();
  const tokenGrantAggregateMock = jest.fn();
  const tokenGrantCountMock = jest.fn();
  const userUpdateMock = jest.fn();
  const tokenGrantFindManyMock = jest.fn();
  const tokenGrantUpdateMock = jest.fn();
  const tokenEventUpdateManyMock = jest.fn();

  const transactionClientMock = {
    tokenEvent: {
      create: tokenEventCreateMock,
      findMany: tokenEventFindManyMock,
      findFirst: tokenEventFindFirstMock,
      updateMany: tokenEventUpdateManyMock,
      count: tokenEventCountMock,
    },
    user: {
      findMany: userFindManyMock,
      count: userCountMock,
      update: userUpdateMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
    tokenGrant: {
      findMany: tokenGrantFindManyMock,
      create: tokenGrantCreateMock,
      update: tokenGrantUpdateMock,
      groupBy: tokenGrantGroupByMock,
      aggregate: tokenGrantAggregateMock,
      count: tokenGrantCountMock,
    },
    tokenLog: {
      create: tokenLogCreateMock,
    },
  };

  const prismaServiceMock = {
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();

    prismaServiceMock.$transaction.mockImplementation(
      async (
        callback: (tx: typeof transactionClientMock) => Promise<unknown>,
      ) => callback(transactionClientMock),
    );

    service = new TokenEventsService(
      prismaServiceMock as unknown as PrismaService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a token event and admin action log in one transaction', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const createdAt = new Date('2026-08-02T06:30:00.000Z');

    tokenEventCreateMock.mockResolvedValue({
      id: tokenEventId,
      eventName: 'KSA Welcome Event',
      createdAt,
      creator: {
        id: adminId,
        name: 'Sulynn Kim',
      },
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(
      service.create(
        {
          eventName: '  KSA Welcome Event  ',
        },
        adminId,
      ),
    ).resolves.toEqual({
      tokenEventId,
      eventName: 'KSA Welcome Event',
      createdBy: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      createdAt,
    });

    expect(prismaServiceMock.$transaction).toHaveBeenCalledTimes(1);

    expect(tokenEventCreateMock).toHaveBeenCalledWith({
      data: {
        createdBy: adminId,
        eventName: 'KSA Welcome Event',
      },
      select: {
        id: true,
        eventName: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.TOKEN,
        action: AdminAction.CREATE_TOKEN_EVENT,
        targetId: tokenEventId,
        metadata: {
          eventName: 'KSA Welcome Event',
        },
      },
    });

    expect(tokenGrantCreateMock).not.toHaveBeenCalled();
    expect(tokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should propagate a transaction failure', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    tokenEventCreateMock.mockResolvedValue({
      id: '3f6e9f0a-1234-4c11-9f10-abc123456789',
      eventName: 'KSA Welcome Event',
      createdAt: new Date(),
      creator: {
        id: adminId,
        name: 'Sulynn Kim',
      },
    });

    adminActionLogCreateMock.mockRejectedValue(
      new Error('Admin action log creation failed'),
    );

    await expect(
      service.create(
        {
          eventName: 'KSA Welcome Event',
        },
        adminId,
      ),
    ).rejects.toThrow('Admin action log creation failed');
  });

  it('should return a paginated token event list', async () => {
    const firstEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const secondEventId = '7a2b1c9d-5678-4d22-8e20-def987654321';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const firstCreatedAt = new Date('2026-08-02T06:30:00.000Z');
    const secondCreatedAt = new Date('2026-08-01T06:30:00.000Z');
    const lastGrantUpdatedAt = new Date('2026-08-02T09:15:00.000Z');

    tokenEventFindManyMock.mockResolvedValue([
      {
        id: firstEventId,
        eventName: 'KSA Welcome Event',
        createdAt: firstCreatedAt,
        creator: {
          id: adminId,
          name: 'Sulynn Kim',
        },
      },
      {
        id: secondEventId,
        eventName: 'Orientation Attendance',
        createdAt: secondCreatedAt,
        creator: {
          id: adminId,
          name: 'Sulynn Kim',
        },
      },
    ]);

    tokenEventCountMock.mockResolvedValue(2);

    tokenGrantGroupByMock
      .mockResolvedValueOnce([
        {
          tokenEventId: firstEventId,
          _max: {
            updatedAt: lastGrantUpdatedAt,
          },
        },
      ])
      .mockResolvedValueOnce([
        {
          tokenEventId: firstEventId,
          _count: {
            _all: 35,
          },
        },
      ]);

    await expect(
      service.findAll({
        page: 1,
        limit: 20,
        keyword: 'Welcome',
      }),
    ).resolves.toEqual({
      items: [
        {
          tokenEventId: firstEventId,
          eventName: 'KSA Welcome Event',
          createdBy: {
            userId: adminId,
            name: 'Sulynn Kim',
          },
          createdAt: firstCreatedAt,
          lastGrantUpdatedAt,
          grantedMemberCount: 35,
        },
        {
          tokenEventId: secondEventId,
          eventName: 'Orientation Attendance',
          createdBy: {
            userId: adminId,
            name: 'Sulynn Kim',
          },
          createdAt: secondCreatedAt,
          lastGrantUpdatedAt: null,
          grantedMemberCount: 0,
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      },
    });

    expect(tokenEventFindManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        eventName: {
          contains: 'Welcome',
          mode: 'insensitive',
        },
      },
      skip: 0,
      take: 20,
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      select: {
        id: true,
        eventName: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    expect(tokenEventCountMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        eventName: {
          contains: 'Welcome',
          mode: 'insensitive',
        },
      },
    });

    expect(tokenGrantGroupByMock).toHaveBeenNthCalledWith(1, {
      by: ['tokenEventId'],
      where: {
        tokenEventId: {
          in: [firstEventId, secondEventId],
        },
      },
      _max: {
        updatedAt: true,
      },
    });

    expect(tokenGrantGroupByMock).toHaveBeenNthCalledWith(2, {
      by: ['tokenEventId'],
      where: {
        tokenEventId: {
          in: [firstEventId, secondEventId],
        },
        grantedAmount: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return an empty paginated result', async () => {
    tokenEventFindManyMock.mockResolvedValue([]);
    tokenEventCountMock.mockResolvedValue(0);

    await expect(
      service.findAll({
        page: 3,
        limit: 20,
      }),
    ).resolves.toEqual({
      items: [],
      pagination: {
        page: 3,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });

    expect(tokenEventFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
        },
        skip: 40,
        take: 20,
      }),
    );

    expect(tokenGrantGroupByMock).not.toHaveBeenCalled();
    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return token event detail and member grant states', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const activeStudentId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
    const blockedStudentId = 'c7d82b1f-3333-4a11-9f10-abc123456789';
    const tokenGrantId = '9f3a2b1c-3333-4d22-8e20-def987654321';

    const createdAt = new Date('2026-08-01T06:30:00.000Z');
    const eventUpdatedAt = new Date('2026-08-02T06:30:00.000Z');
    const grantedAt = new Date('2026-08-02T07:00:00.000Z');
    const grantUpdatedAt = new Date('2026-08-02T09:15:00.000Z');

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
      eventName: 'KSA Welcome Event',
      createdAt,
      updatedAt: eventUpdatedAt,
      creator: {
        id: adminId,
        name: 'Sulynn Kim',
      },
    });

    userFindManyMock.mockResolvedValue([
      {
        id: activeStudentId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        email: 'alex.chan@connect.ust.hk',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 9,
        tokenGrantsAsUser: [],
      },
      {
        id: blockedStudentId,
        name: 'Ben Lee',
        studentNumber: '20999999',
        email: 'ben.lee@connect.ust.hk',
        role: UserRole.STUDENT,
        status: UserStatus.BLOCKED,
        deletedAt: null,
        tokenBalance: 5,
        tokenGrantsAsUser: [
          {
            id: tokenGrantId,
            grantedAmount: 1,
            reason: 'Attendance',
            createdAt: grantedAt,
            updatedAt: grantUpdatedAt,
            admin: {
              id: adminId,
              name: 'Sulynn Kim',
            },
          },
        ],
      },
    ]);

    userCountMock.mockResolvedValue(2);

    tokenGrantAggregateMock.mockResolvedValue({
      _max: {
        updatedAt: grantUpdatedAt,
      },
    });

    tokenGrantCountMock.mockResolvedValue(1);

    await expect(
      service.findOne(tokenEventId, {
        page: 1,
        limit: 20,
        keyword: 'Alex',
        grantStatus: TokenGrantStatusFilter.ALL,
      }),
    ).resolves.toEqual({
      tokenEventId,
      eventName: 'KSA Welcome Event',
      createdBy: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      createdAt,
      eventUpdatedAt,
      lastGrantUpdatedAt: grantUpdatedAt,
      grantedMemberCount: 1,
      items: [
        {
          userId: activeStudentId,
          name: 'Alex Chan',
          studentNumber: '20967890',
          email: 'alex.chan@connect.ust.hk',
          grantEligibility: 'ELIGIBLE',
          currentTokenBalance: 9,
          tokenGrantId: null,
          grantedAmount: null,
          reason: null,
          grantedBy: null,
          grantedAt: null,
          grantUpdatedAt: null,
        },
        {
          userId: blockedStudentId,
          name: 'Ben Lee',
          studentNumber: '20999999',
          email: 'ben.lee@connect.ust.hk',
          grantEligibility: 'ADJUSTMENT_ONLY',
          currentTokenBalance: 5,
          tokenGrantId,
          grantedAmount: 1,
          reason: 'Attendance',
          grantedBy: {
            userId: adminId,
            name: 'Sulynn Kim',
          },
          grantedAt,
          grantUpdatedAt,
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      },
    });

    expect(tokenEventFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: tokenEventId,
        deletedAt: null,
      },
      select: {
        id: true,
        eventName: true,
        createdAt: true,
        updatedAt: true,
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    expect(tokenGrantCountMock).toHaveBeenCalledWith({
      where: {
        tokenEventId,
        grantedAmount: {
          gt: 0,
        },
      },
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return T404 when the token event is unavailable', async () => {
    tokenEventFindFirstMock.mockResolvedValue(null);

    try {
      await service.findOne('3f6e9f0a-1234-4c11-9f10-abc123456789', {
        page: 1,
        limit: 20,
        grantStatus: TokenGrantStatusFilter.ALL,
      });

      throw new Error('Expected findOne to throw a NotFoundException');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);

      if (
        typeof error !== 'object' ||
        error === null ||
        !('getStatus' in error) ||
        !('getResponse' in error)
      ) {
        throw error;
      }

      const exception = error as {
        getStatus: () => number;
        getResponse: () => unknown;
      };

      expect(exception.getStatus()).toBe(404);
      expect(exception.getResponse()).toEqual({
        errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
        message: 'Token event not found',
      });
    }

    expect(userFindManyMock).not.toHaveBeenCalled();
    expect(tokenGrantAggregateMock).not.toHaveBeenCalled();
  });

  it('should create an initial token grant and EVENT_GRANT log', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const userId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
    const tokenGrantId = '9f3a2b1c-3333-4d22-8e20-def987654321';
    const tokenLogId = '2d4c6f8a-4444-4d22-8e20-def987654321';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: userId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 9,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([]);

    tokenGrantCreateMock.mockResolvedValue({
      id: tokenGrantId,
    });

    userUpdateMock.mockResolvedValue({
      id: userId,
    });

    tokenLogCreateMock.mockResolvedValue({
      id: tokenLogId,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId,
            grantedAmount: 5,
            reason: 'Attendance',
          },
        ],
      }),
    ).resolves.toEqual({
      tokenEventId,
      processedCount: 1,
      savedCount: 1,
      unchangedCount: 0,
      items: [
        {
          status: 'CREATED',
          tokenGrantId,
          tokenLogId,
          userId,
          name: 'Alex Chan',
          studentNumber: '20967890',
          previousGrantedAmount: 0,
          grantedAmount: 5,
          deltaAmount: 5,
          reason: 'Attendance',
          balanceBefore: 9,
          balanceAfter: 14,
        },
      ],
    });

    expect(tokenGrantCreateMock).toHaveBeenCalledWith({
      data: {
        tokenEventId,
        userId,
        grantedBy: adminId,
        grantedAmount: 5,
        reason: 'Attendance',
      },
      select: {
        id: true,
      },
    });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        tokenBalance: {
          increment: 5,
        },
      },
    });

    expect(tokenLogCreateMock).toHaveBeenCalledWith({
      data: {
        transactionType: TokenTransactionType.EVENT_GRANT,
        adminId,
        userId,
        tokenGrantId,
        balanceBefore: 9,
        balanceAfter: 14,
        delta: 5,
        reason: 'Attendance',
      },
      select: {
        id: true,
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.TOKEN,
        targetId: tokenEventId,
        action: AdminAction.SAVE_TOKEN_GRANTS,
        metadata: {
          tokenEventId,
          processedCount: 1,
          savedCount: 1,
          unchangedCount: 0,
          changes: [
            {
              userId,
              status: 'CREATED',
              previousGrantedAmount: 0,
              grantedAmount: 5,
              deltaAmount: 5,
              reasonChanged: false,
            },
          ],
        },
      },
    });
  });

  it('should apply only the difference when increasing a grant', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const userId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
    const tokenGrantId = '9f3a2b1c-3333-4d22-8e20-def987654321';
    const tokenLogId = '2d4c6f8a-4444-4d22-8e20-def987654321';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: userId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 4,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([
      {
        id: tokenGrantId,
        userId,
        grantedAmount: 2,
        reason: 'Event helper',
      },
    ]);

    tokenGrantUpdateMock.mockResolvedValue({
      id: tokenGrantId,
    });

    userUpdateMock.mockResolvedValue({
      id: userId,
    });

    tokenLogCreateMock.mockResolvedValue({
      id: tokenLogId,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId,
            grantedAmount: 5,
            reason: 'Event helper',
          },
        ],
      }),
    ).resolves.toEqual({
      tokenEventId,
      processedCount: 1,
      savedCount: 1,
      unchangedCount: 0,
      items: [
        {
          status: 'UPDATED',
          tokenGrantId,
          tokenLogId,
          userId,
          name: 'Alex Chan',
          studentNumber: '20967890',
          previousGrantedAmount: 2,
          grantedAmount: 5,
          deltaAmount: 3,
          reason: 'Event helper',
          balanceBefore: 4,
          balanceAfter: 7,
        },
      ],
    });

    expect(tokenGrantUpdateMock).toHaveBeenCalledWith({
      where: {
        id: tokenGrantId,
      },
      data: {
        grantedAmount: 5,
        reason: 'Event helper',
      },
    });

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        tokenBalance: {
          increment: 3,
        },
      },
    });

    expect(tokenLogCreateMock).toHaveBeenCalledWith({
      data: {
        transactionType: TokenTransactionType.EVENT_ADJUSTMENT,
        adminId,
        userId,
        tokenGrantId,
        balanceBefore: 4,
        balanceAfter: 7,
        delta: 3,
        reason: 'Event helper',
      },
      select: {
        id: true,
      },
    });
  });

  it('should update only the reason without changing the balance', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const userId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
    const tokenGrantId = '9f3a2b1c-3333-4d22-8e20-def987654321';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: userId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 4,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([
      {
        id: tokenGrantId,
        userId,
        grantedAmount: 2,
        reason: 'Old reason',
      },
    ]);

    tokenGrantUpdateMock.mockResolvedValue({
      id: tokenGrantId,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId,
            grantedAmount: 2,
            reason: 'Updated reason',
          },
        ],
      }),
    ).resolves.toEqual({
      tokenEventId,
      processedCount: 1,
      savedCount: 1,
      unchangedCount: 0,
      items: [
        {
          status: 'UPDATED',
          tokenGrantId,
          tokenLogId: null,
          userId,
          name: 'Alex Chan',
          studentNumber: '20967890',
          previousGrantedAmount: 2,
          grantedAmount: 2,
          deltaAmount: 0,
          reason: 'Updated reason',
          balanceBefore: 4,
          balanceAfter: 4,
        },
      ],
    });

    expect(tokenGrantUpdateMock).toHaveBeenCalledTimes(1);
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(tokenLogCreateMock).not.toHaveBeenCalled();
    expect(adminActionLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it('should return UNCHANGED without writing records', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const existingUserId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
    const newUserId = 'c7d82b1f-3333-4a11-9f10-abc123456789';
    const tokenGrantId = '9f3a2b1c-3333-4d22-8e20-def987654321';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: existingUserId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 4,
      },
      {
        id: newUserId,
        name: 'Ben Lee',
        studentNumber: '20999999',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 0,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([
      {
        id: tokenGrantId,
        userId: existingUserId,
        grantedAmount: 2,
        reason: 'Attendance',
      },
    ]);

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId: existingUserId,
            grantedAmount: 2,
            reason: 'Attendance',
          },
          {
            userId: newUserId,
            grantedAmount: 0,
            reason: 'No grant',
          },
        ],
      }),
    ).resolves.toMatchObject({
      tokenEventId,
      processedCount: 2,
      savedCount: 0,
      unchangedCount: 2,
      items: [
        {
          status: 'UNCHANGED',
          tokenGrantId,
          tokenLogId: null,
          userId: existingUserId,
        },
        {
          status: 'UNCHANGED',
          tokenGrantId: null,
          tokenLogId: null,
          userId: newUserId,
        },
      ],
    });

    expect(tokenGrantCreateMock).not.toHaveBeenCalled();
    expect(tokenGrantUpdateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(tokenLogCreateMock).not.toHaveBeenCalled();
    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject the full request when a recovery would make a balance negative', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const firstUserId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
    const secondUserId = 'c7d82b1f-3333-4a11-9f10-abc123456789';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: firstUserId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 0,
      },
      {
        id: secondUserId,
        name: 'Ben Lee',
        studentNumber: '20999999',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 1,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([
      {
        id: '9f3a2b1c-3333-4d22-8e20-def987654321',
        userId: secondUserId,
        grantedAmount: 5,
        reason: 'Attendance',
      },
    ]);

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId: firstUserId,
            grantedAmount: 2,
            reason: 'Event helper',
          },
          {
            userId: secondUserId,
            grantedAmount: 0,
            reason: 'Recovered',
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'T409_INSUFFICIENT_TOKEN_BALANCE',
        message:
          'The token grant cannot be reduced because the user has insufficient balance',
      },
    });

    expect(tokenGrantCreateMock).not.toHaveBeenCalled();
    expect(tokenGrantUpdateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(tokenLogCreateMock).not.toHaveBeenCalled();
    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a grant increase for an ineligible member', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const userId = 'a8d91c2e-2222-4a11-9f10-abc123456789';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: userId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.BLOCKED,
        deletedAt: null,
        tokenBalance: 3,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([
      {
        id: '9f3a2b1c-3333-4d22-8e20-def987654321',
        userId,
        grantedAmount: 1,
        reason: 'Attendance',
      },
    ]);

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId,
            grantedAmount: 2,
            reason: 'Attendance',
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'T409_TOKEN_GRANT_TARGET_INELIGIBLE',
        message:
          'Target user is not eligible for a new or increased token grant',
      },
    });

    expect(tokenGrantUpdateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(tokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return U404 when a submitted user does not exist', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const missingUserId = 'a8d91c2e-2222-4a11-9f10-abc123456789';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([]);
    tokenGrantFindManyMock.mockResolvedValue([]);

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId: missingUserId,
            grantedAmount: 1,
            reason: 'Attendance',
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'U404_USER_NOT_FOUND',
        message: 'Target user not found',
      },
    });

    expect(tokenGrantCreateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it('should retry a P2034 serializable transaction conflict', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
    const userId = 'a8d91c2e-2222-4a11-9f10-abc123456789';

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

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
    });

    userFindManyMock.mockResolvedValue([
      {
        id: userId,
        name: 'Alex Chan',
        studentNumber: '20967890',
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 0,
      },
    ]);

    tokenGrantFindManyMock.mockResolvedValue([]);

    await expect(
      service.saveGrants(tokenEventId, adminId, {
        grants: [
          {
            userId,
            grantedAmount: 0,
            reason: 'No grant',
          },
        ],
      }),
    ).resolves.toMatchObject({
      tokenEventId,
      processedCount: 1,
      savedCount: 0,
      unchangedCount: 1,
    });

    expect(prismaServiceMock.$transaction).toHaveBeenCalledTimes(3);

    expect(prismaServiceMock.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  });

  it('should soft delete a token event and create an admin action log', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
      eventName: 'KSA Welcome Event',
    });

    tokenGrantCountMock.mockResolvedValue(3);

    tokenEventUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    const result = await service.deleteTokenEvent(tokenEventId, adminId);

    expect(result.deletedTokenEventId).toBe(tokenEventId);

    expect(result.deletedAt).toBeInstanceOf(Date);

    const deletedAt = result.deletedAt;

    expect(tokenEventFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: tokenEventId,
        deletedAt: null,
      },
      select: {
        id: true,
        eventName: true,
      },
    });

    expect(tokenGrantCountMock).toHaveBeenCalledWith({
      where: {
        tokenEventId,
        grantedAmount: {
          gt: 0,
        },
      },
    });

    expect(tokenEventUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: tokenEventId,
        deletedAt: null,
      },
      data: {
        deletedAt,
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.TOKEN,
        action: AdminAction.DELETE_TOKEN_EVENT,
        targetId: tokenEventId,
        metadata: {
          eventName: 'KSA Welcome Event',
          grantedMemberCount: 3,
          deletedAt: deletedAt.toISOString(),
        },
      },
    });

    expect(userUpdateMock).not.toHaveBeenCalled();
    expect(tokenGrantUpdateMock).not.toHaveBeenCalled();
    expect(tokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return T404 when deleting an unavailable token event', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    tokenEventFindFirstMock.mockResolvedValue(null);

    await expect(
      service.deleteTokenEvent(
        tokenEventId,
        'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
        message: 'Token event not found',
      },
    });

    expect(tokenGrantCountMock).not.toHaveBeenCalled();

    expect(tokenEventUpdateManyMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should update a token event name and create an admin action log', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const previousUpdatedAt = new Date('2026-08-03T03:00:00.000Z');

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
      eventName: 'KSA Welcom Event',
      updatedAt: previousUpdatedAt,
    });

    tokenEventUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 'admin-action-log-id',
    });

    const result = await service.updateTokenEvent(
      tokenEventId,
      {
        eventName: 'KSA Welcome Event',
      },
      adminId,
    );

    expect(result.tokenEventId).toBe(tokenEventId);
    expect(result.eventName).toBe('KSA Welcome Event');
    expect(result.updatedAt).toBeInstanceOf(Date);

    const updatedAt = result.updatedAt;

    expect(tokenEventFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: tokenEventId,
        deletedAt: null,
      },
      select: {
        id: true,
        eventName: true,
        updatedAt: true,
      },
    });

    expect(tokenEventUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: tokenEventId,
        deletedAt: null,
      },
      data: {
        eventName: 'KSA Welcome Event',
        updatedAt,
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.TOKEN,
        action: AdminAction.UPDATE_TOKEN_EVENT,
        targetId: tokenEventId,
        metadata: {
          previousEventName: 'KSA Welcom Event',
          updatedEventName: 'KSA Welcome Event',
        },
      },
    });
  });

  it('should return the existing event without updating or logging when the name is unchanged', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const updatedAt = new Date('2026-08-03T03:00:00.000Z');

    tokenEventFindFirstMock.mockResolvedValue({
      id: tokenEventId,
      eventName: 'KSA Welcome Event',
      updatedAt,
    });

    await expect(
      service.updateTokenEvent(
        tokenEventId,
        {
          eventName: 'KSA Welcome Event',
        },
        adminId,
      ),
    ).resolves.toEqual({
      tokenEventId,
      eventName: 'KSA Welcome Event',
      updatedAt,
    });

    expect(tokenEventUpdateManyMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return T404 when updating an unavailable token event', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    tokenEventFindFirstMock.mockResolvedValue(null);

    await expect(
      service.updateTokenEvent(
        tokenEventId,
        {
          eventName: 'KSA Welcome Event',
        },
        'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
        message: 'Token event not found',
      },
    });

    expect(tokenEventUpdateManyMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });
});
