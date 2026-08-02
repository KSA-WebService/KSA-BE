import { AdminAction, AdminActionType } from '@prisma/client';
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

  const transactionClientMock = {
    tokenEvent: {
      create: tokenEventCreateMock,
      findMany: tokenEventFindManyMock,
      count: tokenEventCountMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
    tokenGrant: {
      create: tokenGrantCreateMock,
      groupBy: tokenGrantGroupByMock,
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
});
