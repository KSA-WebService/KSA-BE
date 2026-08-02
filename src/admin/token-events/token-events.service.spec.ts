import 'reflect-metadata';
import {
  AdminAction,
  AdminActionType,
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

  const transactionClientMock = {
    tokenEvent: {
      create: tokenEventCreateMock,
      findMany: tokenEventFindManyMock,
      findFirst: tokenEventFindFirstMock,
      count: tokenEventCountMock,
    },
    user: {
      findMany: userFindManyMock,
      count: userCountMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
    tokenGrant: {
      create: tokenGrantCreateMock,
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
      page: 1,
      limit: 20,
      totalCount: 2,
      totalPages: 1,
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
      page: 3,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
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
      page: 1,
      limit: 20,
      totalCount: 2,
      totalPages: 1,
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
});
