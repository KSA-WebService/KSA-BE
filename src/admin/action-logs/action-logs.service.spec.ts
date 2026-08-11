import { AdminAction, AdminActionType } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ActionLogsService } from './action-logs.service';
import { GetAdminActionLogsQueryDto } from './dto/get-admin-action-logs-query.dto';

describe('ActionLogsService', () => {
  let service: ActionLogsService;

  const findManyMock = jest.fn();
  const findUniqueMock = jest.fn();
  const countMock = jest.fn();
  const transactionMock = jest.fn();

  const prismaMock = {
    adminActionLog: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
      count: countMock,
    },
    $transaction: transactionMock,
  };

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const createdAt1 = new Date('2026-08-11T14:01:16.048Z');

  const createdAt2 = new Date('2026-08-11T13:00:00.000Z');

  const logs = [
    {
      id: 152,
      actionType: AdminActionType.ORDER,
      action: AdminAction.UPDATE_ORDER_STATUS,
      targetId: 'b109f280-e709-4093-9cb8-054972f305fe',
      createdAt: createdAt1,
      admin: {
        id: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
    },
    {
      id: 151,
      actionType: AdminActionType.TOKEN,
      action: AdminAction.RESET_TOKEN_BALANCES,
      targetId: null,
      createdAt: createdAt2,
      admin: {
        id: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
    },
  ];

  beforeEach(() => {
    jest.resetAllMocks();

    service = new ActionLogsService(prismaMock as unknown as PrismaService);

    findManyMock.mockResolvedValue(logs);
    countMock.mockResolvedValue(2);

    transactionMock.mockResolvedValue([logs, 2]);
  });

  it('should return the default paginated action log list', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await expect(service.getActionLogs(query)).resolves.toEqual({
      items: [
        {
          logId: 152,
          admin: {
            userId: adminId,
            name: 'Sulynn Kim',
            email: 'admin@connect.ust.hk',
          },
          actionType: 'order',
          action: 'update_order_status',
          targetId: 'b109f280-e709-4093-9cb8-054972f305fe',
          createdAt: createdAt1,
        },
        {
          logId: 151,
          admin: {
            userId: adminId,
            name: 'Sulynn Kim',
            email: 'admin@connect.ust.hk',
          },
          actionType: 'token',
          action: 'reset_token_balances',
          targetId: null,
          createdAt: createdAt2,
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 2,
        totalPages: 1,
      },
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {},
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 20,
    });

    expect(countMock).toHaveBeenCalledWith({
      where: {},
    });
  });

  it('should filter by action type', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      actionType: 'order',
      sort: 'latest',
    };

    await service.getActionLogs(query);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        actionType: AdminActionType.ORDER,
      },
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 20,
    });

    expect(countMock).toHaveBeenCalledWith({
      where: {
        actionType: AdminActionType.ORDER,
      },
    });
  });

  it('should filter by administrator ID', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      adminId,
      sort: 'latest',
    };

    await service.getActionLogs(query);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        adminId,
      },
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 20,
    });

    expect(countMock).toHaveBeenCalledWith({
      where: {
        adminId,
      },
    });
  });

  it('should combine the action type and administrator filters', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      actionType: 'token',
      adminId,
      sort: 'latest',
    };

    await service.getActionLogs(query);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        actionType: AdminActionType.TOKEN,
        adminId,
      },
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 20,
    });

    expect(countMock).toHaveBeenCalledWith({
      where: {
        actionType: AdminActionType.TOKEN,
        adminId,
      },
    });
  });

  it('should use stable oldest sorting', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      sort: 'oldest',
    };

    await service.getActionLogs(query);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {},
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'asc',
        },
        {
          id: 'asc',
        },
      ],
      skip: 0,
      take: 20,
    });
  });

  it('should calculate the pagination offset', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 3,
      limit: 10,
      sort: 'latest',
    };

    transactionMock.mockResolvedValue([logs, 45]);

    const result = await service.getActionLogs(query);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {},
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 20,
      take: 10,
    });

    expect(result.pagination).toEqual({
      page: 3,
      limit: 10,
      total: 45,
      totalPages: 5,
    });
  });

  it('should return an empty page when no action logs exist', async () => {
    transactionMock.mockResolvedValue([[], 0]);

    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await expect(service.getActionLogs(query)).resolves.toEqual({
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('should not request metadata or administrator state fields in the list query', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await service.getActionLogs(query);

    expect(findManyMock).toHaveBeenCalledWith({
      where: {},
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        {
          createdAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 20,
    });
  });

  it('should query the list and count in one Prisma transaction', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await service.getActionLogs(query);

    expect(transactionMock).toHaveBeenCalledTimes(1);

    expect(findManyMock).toHaveBeenCalledTimes(1);
    expect(countMock).toHaveBeenCalledTimes(1);
  });

  it('should convert a Prisma failure into the action log list error', async () => {
    transactionMock.mockRejectedValue(new Error('Database failure'));

    const query: GetAdminActionLogsQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await expect(service.getActionLogs(query)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'AL500_ACTION_LOG_LIST_FETCH_FAILED',
        message: 'Failed to fetch admin action logs',
      },
    });
  });

  it('should return an action log detail with metadata mapped to details', async () => {
    const metadata = {
      beforeStatus: 'ordered',
      afterStatus: 'canceled',
      cancellationReason: 'Test cancellation',
    };

    findUniqueMock.mockResolvedValue({
      id: 152,
      actionType: AdminActionType.ORDER,
      action: AdminAction.UPDATE_ORDER_STATUS,
      targetId: 'b109f280-e709-4093-9cb8-054972f305fe',
      createdAt: createdAt1,
      metadata,
      admin: {
        id: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
    });

    await expect(service.getActionLogDetail(152)).resolves.toEqual({
      logId: 152,
      admin: {
        userId: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
      actionType: 'order',
      action: 'update_order_status',
      targetId: 'b109f280-e709-4093-9cb8-054972f305fe',
      createdAt: createdAt1,
      details: metadata,
    });

    expect(findUniqueMock).toHaveBeenCalledTimes(1);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: {
        id: 152,
      },
      select: {
        id: true,
        actionType: true,
        action: true,
        targetId: true,
        createdAt: true,
        metadata: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  });

  it('should return null details when metadata is null', async () => {
    findUniqueMock.mockResolvedValue({
      id: 153,
      actionType: AdminActionType.WHITELIST,
      action: AdminAction.IMPORT_WHITELIST_USERS,
      targetId: null,
      createdAt: createdAt1,
      metadata: null,
      admin: {
        id: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
    });

    await expect(service.getActionLogDetail(153)).resolves.toEqual({
      logId: 153,
      admin: {
        userId: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
      actionType: 'whitelist',
      action: 'import_whitelist_users',
      targetId: null,
      createdAt: createdAt1,
      details: null,
    });
  });

  it('should preserve action-specific metadata without restructuring it', async () => {
    const metadata = {
      affectedMemberCount: 25,
      totalResetAmount: 180,
      reason: 'Semester reset',
    };

    findUniqueMock.mockResolvedValue({
      id: 154,
      actionType: AdminActionType.TOKEN,
      action: AdminAction.RESET_TOKEN_BALANCES,
      targetId: null,
      createdAt: createdAt1,
      metadata,
      admin: {
        id: adminId,
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
    });

    const result = await service.getActionLogDetail(154);

    expect(result.details).toEqual({
      affectedMemberCount: 25,
      totalResetAmount: 180,
      reason: 'Semester reset',
    });
  });

  it('should throw not found when the action log does not exist', async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(service.getActionLogDetail(999999)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'AL404_ACTION_LOG_NOT_FOUND',
        message: 'Admin action log not found',
      },
    });
  });

  it('should convert an unexpected Prisma failure into the detail fetch error', async () => {
    findUniqueMock.mockRejectedValue(new Error('Database failure'));

    await expect(service.getActionLogDetail(152)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'AL500_ACTION_LOG_DETAIL_FETCH_FAILED',
        message: 'Failed to fetch admin action log detail',
      },
    });
  });
});
