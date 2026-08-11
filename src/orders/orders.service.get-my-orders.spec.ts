import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { GetMyOrdersQueryDto } from './dto/get-my-orders-query.dto';
import { OrdersService } from './orders.service';

describe('OrdersService - getMyOrders', () => {
  let service: OrdersService;

  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const findManyMock = jest.fn();
  const countMock = jest.fn();
  const transactionMock = jest.fn();

  const prismaMock = {
    order: {
      findMany: findManyMock,
      count: countMock,
    },
    $transaction: transactionMock,
  };

  const orderedAt = new Date('2026-08-10T10:00:00.000Z');
  const acceptedAt = new Date('2026-08-10T11:00:00.000Z');
  const deliveredAt = new Date('2026-08-10T12:00:00.000Z');
  const canceledAt = new Date('2026-08-10T13:00:00.000Z');

  beforeEach(() => {
    jest.resetAllMocks();

    service = new OrdersService(prismaMock as unknown as PrismaService);

    transactionMock.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
  });

  it('should return the authenticated user orders with default latest sorting', async () => {
    findManyMock.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        quantity: 2,
        unitPrice: 10,
        totalAmount: 20,
        status: OrderStatus.ORDERED,
        createdAt: orderedAt,
        acceptedAt: null,
        deliveredAt: null,
        canceledAt: null,
        cancellationReason: null,
        product: {
          id: '22222222-2222-4222-8222-222222222222',
          name: 'Lucky Draw Ticket',
        },
      },
    ]);

    countMock.mockResolvedValue(1);

    const query: GetMyOrdersQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await expect(service.getMyOrders(userId, query)).resolves.toEqual({
      items: [
        {
          orderId: '11111111-1111-4111-8111-111111111111',
          product: {
            productId: '22222222-2222-4222-8222-222222222222',
            productName: 'Lucky Draw Ticket',
          },
          quantity: 2,
          unitPrice: 10,
          totalAmount: 20,
          orderStatus: 'ordered',
          orderedAt,
          acceptedAt: null,
          deliveredAt: null,
          canceledAt: null,
          cancellationReason: null,
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    expect(findManyMock).toHaveBeenCalledWith({
      where: {
        userId,
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        acceptedAt: true,
        deliveredAt: true,
        canceledAt: true,
        cancellationReason: true,
        product: {
          select: {
            id: true,
            name: true,
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
        userId,
      },
    });
  });

  it('should filter by accepted order status', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    const query: GetMyOrdersQueryDto = {
      page: 1,
      limit: 20,
      orderStatus: 'accepted',
      sort: 'latest',
    };

    await service.getMyOrders(userId, query);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
          status: OrderStatus.ACCEPTED,
        },
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: {
        userId,
        status: OrderStatus.ACCEPTED,
      },
    });
  });

  it('should support every order status filter', async () => {
    const cases = [
      {
        apiStatus: 'ordered' as const,
        prismaStatus: OrderStatus.ORDERED,
      },
      {
        apiStatus: 'accepted' as const,
        prismaStatus: OrderStatus.ACCEPTED,
      },
      {
        apiStatus: 'delivered' as const,
        prismaStatus: OrderStatus.DELIVERED,
      },
      {
        apiStatus: 'canceled' as const,
        prismaStatus: OrderStatus.CANCELED,
      },
    ];

    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    for (const testCase of cases) {
      jest.clearAllMocks();

      transactionMock.mockImplementation(
        async (operations: Promise<unknown>[]) => Promise.all(operations),
      );

      findManyMock.mockResolvedValue([]);
      countMock.mockResolvedValue(0);

      await service.getMyOrders(userId, {
        page: 1,
        limit: 20,
        orderStatus: testCase.apiStatus,
        sort: 'latest',
      });

      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            status: testCase.prismaStatus,
          },
        }),
      );
    }
  });

  it('should use oldest stable sorting when requested', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    const query: GetMyOrdersQueryDto = {
      page: 1,
      limit: 20,
      sort: 'oldest',
    };

    await service.getMyOrders(userId, query);

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            createdAt: 'asc',
          },
          {
            id: 'asc',
          },
        ],
      }),
    );
  });

  it('should calculate pagination offset correctly', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(45);

    const query: GetMyOrdersQueryDto = {
      page: 3,
      limit: 10,
      sort: 'latest',
    };

    await expect(service.getMyOrders(userId, query)).resolves.toMatchObject({
      pagination: {
        page: 3,
        limit: 10,
        total: 45,
        totalPages: 5,
      },
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
  });

  it('should return an empty successful result when the user has no orders', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await expect(
      service.getMyOrders(userId, {
        page: 1,
        limit: 20,
        sort: 'latest',
      }),
    ).resolves.toEqual({
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  });

  it('should preserve accepted timestamp when an accepted order is later canceled', async () => {
    findManyMock.mockResolvedValue([
      {
        id: '33333333-3333-4333-8333-333333333333',
        quantity: 1,
        unitPrice: 50,
        totalAmount: 50,
        status: OrderStatus.CANCELED,
        createdAt: orderedAt,
        acceptedAt,
        deliveredAt: null,
        canceledAt,
        cancellationReason: 'Item is no longer available',
        product: {
          id: '44444444-4444-4444-8444-444444444444',
          name: 'KSA Merchandise',
        },
      },
    ]);

    countMock.mockResolvedValue(1);

    const result = await service.getMyOrders(userId, {
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(result.items[0]).toMatchObject({
      orderStatus: 'canceled',
      acceptedAt,
      deliveredAt: null,
      canceledAt,
      cancellationReason: 'Item is no longer available',
    });
  });

  it('should return delivered timestamps for delivered orders', async () => {
    findManyMock.mockResolvedValue([
      {
        id: '55555555-5555-4555-8555-555555555555',
        quantity: 1,
        unitPrice: 100,
        totalAmount: 100,
        status: OrderStatus.DELIVERED,
        createdAt: orderedAt,
        acceptedAt,
        deliveredAt,
        canceledAt: null,
        cancellationReason: null,
        product: {
          id: '66666666-6666-4666-8666-666666666666',
          name: 'Event Ticket',
        },
      },
    ]);

    countMock.mockResolvedValue(1);

    const result = await service.getMyOrders(userId, {
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(result.items[0]).toMatchObject({
      orderStatus: 'delivered',
      acceptedAt,
      deliveredAt,
      canceledAt: null,
      cancellationReason: null,
    });
  });

  it('should not add a product soft-delete filter to the query', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getMyOrders(userId, {
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId,
        },
      }),
    );
  });

  it('should execute the list and count queries in one Prisma transaction', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(3);

    await service.getMyOrders(userId, {
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Array));
  });
});
