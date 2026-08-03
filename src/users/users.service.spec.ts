import { Test, TestingModule } from '@nestjs/testing';
import { TokenTransactionType, UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const userFindFirstMock = jest.fn();
  const tokenLogFindManyMock = jest.fn();
  const tokenLogCountMock = jest.fn();

  const prismaServiceMock = {
    user: {
      findFirst: userFindFirstMock,
    },
    tokenLog: {
      findMany: tokenLogFindManyMock,
      count: tokenLogCountMock,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the current active user profile', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    userFindFirstMock.mockResolvedValue({
      id: userId,
      name: 'Sulynn Kim',
      studentNumber: '20912345',
      email: 'user@connect.ust.hk',
      role: UserRole.STUDENT,
      tokenBalance: 9,
      status: UserStatus.ACTIVE,
      agreedPrivacy: true,
      agreedAt: null,
    });

    await expect(service.findMe(userId)).resolves.toEqual({
      userId,
      name: 'Sulynn Kim',
      studentNumber: '20912345',
      email: 'user@connect.ust.hk',
      role: UserRole.STUDENT,
      tokenBalance: 9,
      status: UserStatus.ACTIVE,
      agreedPrivacy: true,
      agreedAt: null,
    });

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        studentNumber: true,
        email: true,
        role: true,
        tokenBalance: true,
        status: true,
        agreedPrivacy: true,
        agreedAt: true,
      },
    });
  });

  it('should return the current balance and paginated token history', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const eventLogId = '7c1d52b0-1111-4d22-8e20-abc123456789';

    const orderLogId = '8d2e63c1-2222-4d22-8e20-def987654321';

    const resetLogId = '9e3f74d2-3333-4d22-8e20-abc987654321';

    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    const orderId = '0f4a85e3-4444-4d22-8e20-abc987654321';

    const productId = '1a5b96f4-5555-4d22-8e20-def987654321';

    const eventCreatedAt = new Date('2026-07-20T07:00:00.000Z');

    const orderCreatedAt = new Date('2026-07-22T08:00:00.000Z');

    const resetCreatedAt = new Date('2026-08-03T04:00:00.000Z');

    userFindFirstMock.mockResolvedValue({
      id: userId,
      tokenBalance: 0,
    });

    tokenLogFindManyMock.mockResolvedValue([
      {
        id: resetLogId,
        transactionType: TokenTransactionType.RESET,
        delta: -5,
        reason: 'End of Spring 2026 semester',
        balanceBefore: 5,
        balanceAfter: 0,
        createdAt: resetCreatedAt,
        tokenGrant: null,
        order: null,
      },
      {
        id: orderLogId,
        transactionType: TokenTransactionType.ORDER_PAYMENT,
        delta: -3,
        reason: 'Product order',
        balanceBefore: 8,
        balanceAfter: 5,
        createdAt: orderCreatedAt,
        tokenGrant: null,
        order: {
          id: orderId,
          productId,
          quantity: 1,
          unitPrice: 3,
          totalAmount: 3,
          product: {
            name: 'Coffee Coupon',
          },
        },
      },
      {
        id: eventLogId,
        transactionType: TokenTransactionType.EVENT_GRANT,
        delta: 2,
        reason: 'Attandance',
        balanceBefore: 6,
        balanceAfter: 8,
        createdAt: eventCreatedAt,
        tokenGrant: {
          reason: 'Attendance',
          tokenEvent: {
            id: tokenEventId,
            eventName: 'KSA Welcome Event',
          },
        },
        order: null,
      },
    ]);

    tokenLogCountMock.mockResolvedValue(3);

    await expect(
      service.findMyTokenLogs(userId, {
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      currentTokenBalance: 0,
      items: [
        {
          tokenLogId: resetLogId,
          transactionType: TokenTransactionType.RESET,
          delta: -5,
          reason: 'End of Spring 2026 semester',
          balanceBefore: 5,
          balanceAfter: 0,
          createdAt: resetCreatedAt,
          tokenEvent: null,
          order: null,
        },
        {
          tokenLogId: orderLogId,
          transactionType: TokenTransactionType.ORDER_PAYMENT,
          delta: -3,
          reason: 'Product order',
          balanceBefore: 8,
          balanceAfter: 5,
          createdAt: orderCreatedAt,
          tokenEvent: null,
          order: {
            orderId,
            productId,
            productName: 'Coffee Coupon',
            quantity: 1,
            unitPrice: 3,
            totalAmount: 3,
          },
        },
        {
          tokenLogId: eventLogId,
          transactionType: TokenTransactionType.EVENT_GRANT,
          delta: 2,
          reason: 'Attendance',
          balanceBefore: 6,
          balanceAfter: 8,
          createdAt: eventCreatedAt,
          tokenEvent: {
            tokenEventId,
            eventName: 'KSA Welcome Event',
          },
          order: null,
        },
      ],
      page: 1,
      limit: 20,
      totalCount: 3,
      totalPages: 1,
    });

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        tokenBalance: true,
      },
    });

    expect(tokenLogFindManyMock).toHaveBeenCalledWith({
      where: {
        userId,
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
        transactionType: true,
        delta: true,
        reason: true,
        balanceBefore: true,
        balanceAfter: true,
        createdAt: true,
        tokenGrant: {
          select: {
            reason: true,
            tokenEvent: {
              select: {
                id: true,
                eventName: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            totalAmount: true,
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    expect(tokenLogCountMock).toHaveBeenCalledWith({
      where: {
        userId,
      },
    });
  });

  it('should return an empty token history', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    userFindFirstMock.mockResolvedValue({
      id: userId,
      tokenBalance: 0,
    });

    tokenLogFindManyMock.mockResolvedValue([]);
    tokenLogCountMock.mockResolvedValue(0);

    await expect(
      service.findMyTokenLogs(userId, {
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual({
      currentTokenBalance: 0,
      items: [],
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it('should return A403 when an active user profile is unavailable', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    userFindFirstMock.mockResolvedValue(null);

    await expect(service.findMe(userId)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403',
        message: 'Active user access is required',
      },
    });
  });

  it('should not query token logs when the active user is unavailable', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    userFindFirstMock.mockResolvedValue(null);

    await expect(
      service.findMyTokenLogs(userId, {
        page: 1,
        limit: 20,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403',
        message: 'Active user access is required',
      },
    });

    expect(tokenLogFindManyMock).not.toHaveBeenCalled();

    expect(tokenLogCountMock).not.toHaveBeenCalled();
  });
});
