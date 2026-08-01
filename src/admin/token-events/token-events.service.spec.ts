import { AdminAction, AdminActionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenEventsService } from './token-events.service';

describe('TokenEventsService', () => {
  let service: TokenEventsService;

  const tokenEventCreateMock = jest.fn();
  const adminActionLogCreateMock = jest.fn();
  const tokenGrantCreateMock = jest.fn();
  const tokenLogCreateMock = jest.fn();

  const transactionClientMock = {
    tokenEvent: {
      create: tokenEventCreateMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
    tokenGrant: {
      create: tokenGrantCreateMock,
    },
    tokenLog: {
      create: tokenLogCreateMock,
    },
  };

  const prismaServiceMock = {
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

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
});
