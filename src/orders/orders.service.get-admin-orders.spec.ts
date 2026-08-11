import { OrderStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders-query.dto';
import { OrdersService } from './orders.service';

describe('OrdersService - getAdminOrders', () => {
  let service: OrdersService;

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

  const orderId = 'a99baf4a-5e42-4246-a086-2b1e7edb3139';
  const productId = '89a9bf59-1ade-471f-90d6-6596f5d80d55';
  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const orderedAt = new Date('2026-08-10T09:00:00.000Z');
  const acceptedAt = new Date('2026-08-10T10:00:00.000Z');
  const canceledAt = new Date('2026-08-10T11:00:00.000Z');

  beforeEach(() => {
    jest.resetAllMocks();

    service = new OrdersService(prismaMock as unknown as PrismaService);

    transactionMock.mockImplementation(async (operations: Promise<unknown>[]) =>
      Promise.all(operations),
    );
  });

  it('should return all orders with product and customer information', async () => {
    findManyMock.mockResolvedValue([
      {
        id: orderId,
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
          id: productId,
          name: 'Lucky Draw Ticket',
        },
        user: {
          id: userId,
          name: 'Sulynn Kim',
          studentNumber: '20912345',
          email: 'user@connect.ust.hk',
        },
      },
    ]);

    countMock.mockResolvedValue(1);

    const query: GetAdminOrdersQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    await expect(service.getAdminOrders(query)).resolves.toEqual({
      items: [
        {
          orderId,
          product: {
            productId,
            productName: 'Lucky Draw Ticket',
          },
          customer: {
            userId,
            customerName: 'Sulynn Kim',
            studentNumber: '20912345',
            email: 'user@connect.ust.hk',
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
      where: {},
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
        user: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
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

  it('should filter orders by status', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      orderStatus: 'accepted',
      sort: 'latest',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: OrderStatus.ACCEPTED,
        },
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: {
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

    for (const testCase of cases) {
      findManyMock.mockResolvedValue([]);
      countMock.mockResolvedValue(0);

      await service.getAdminOrders({
        page: 1,
        limit: 20,
        orderStatus: testCase.apiStatus,
        sort: 'latest',
      });

      expect(findManyMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            status: testCase.prismaStatus,
          },
        }),
      );
    }
  });

  it('should search product and customer fields using a normalized keyword', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      keyword: '  Sulynn  ',
      sort: 'latest',
    });

    const expectedWhere = {
      OR: [
        {
          product: {
            name: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            name: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            studentNumber: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            email: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
      ],
    };

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should add an exact order ID condition when keyword is a valid UUID', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      keyword: orderId,
      sort: 'latest',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            {
              id: orderId,
            },
            {
              product: {
                name: {
                  contains: orderId,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                name: {
                  contains: orderId,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                studentNumber: {
                  contains: orderId,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                email: {
                  contains: orderId,
                  mode: 'insensitive',
                },
              },
            },
          ],
        },
      }),
    );
  });

  it('should not add an order ID condition for a partial UUID keyword', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      keyword: 'a99baf4a',
      sort: 'latest',
    });

    const expectedWhere = {
      OR: [
        {
          product: {
            name: {
              contains: 'a99baf4a',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            name: {
              contains: 'a99baf4a',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            studentNumber: {
              contains: 'a99baf4a',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            email: {
              contains: 'a99baf4a',
              mode: 'insensitive',
            },
          },
        },
      ],
    };

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );
  });

  it('should ignore a whitespace-only keyword', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      keyword: '   ',
      sort: 'latest',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: {},
    });
  });

  it('should combine keyword and order status filters', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      keyword: 'Sulynn',
      orderStatus: 'ordered',
      sort: 'latest',
    });

    const expectedWhere = {
      status: OrderStatus.ORDERED,
      OR: [
        {
          product: {
            name: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            name: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            studentNumber: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            email: {
              contains: 'Sulynn',
              mode: 'insensitive',
            },
          },
        },
      ],
    };

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should use oldest stable sorting when requested', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      sort: 'oldest',
    });

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

  it('should calculate pagination correctly', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(45);

    await expect(
      service.getAdminOrders({
        page: 3,
        limit: 10,
        sort: 'latest',
      }),
    ).resolves.toMatchObject({
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

  it('should return an empty successful result when no orders match', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await expect(
      service.getAdminOrders({
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

  it('should preserve accepted information for an accepted order that was later canceled', async () => {
    findManyMock.mockResolvedValue([
      {
        id: orderId,
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
          id: productId,
          name: 'KSA Merchandise',
        },
        user: {
          id: userId,
          name: 'Sulynn Kim',
          studentNumber: '20912345',
          email: 'user@connect.ust.hk',
        },
      },
    ]);

    countMock.mockResolvedValue(1);

    const result = await service.getAdminOrders({
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

  it('should not filter out soft-deleted users or products', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );

    expect(countMock).toHaveBeenCalledWith({
      where: {},
    });
  });

  it('should execute list and count queries in one Prisma transaction', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(3);

    await service.getAdminOrders({
      page: 1,
      limit: 20,
      sort: 'latest',
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Array));
  });
});
