import {
  AdminAction,
  AdminActionType,
  OrderStatus,
  Prisma,
  TokenTransactionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService - updateOrderStatus', () => {
  let service: OrdersService;

  const orderId = '6c1e9d2a-1234-4c29-81e6-8faec8fbda53';
  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';
  const userId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
  const adminId = '9b3a2d4f-5678-4d22-8e20-def987654321';

  const orderedAt = new Date('2026-08-10T09:00:00.000Z');
  const acceptedAt = new Date('2026-08-10T10:00:00.000Z');
  const statusChangedAt = new Date('2026-08-11T12:00:00.000Z');

  const rootOrderFindUniqueMock = jest.fn();

  const txOrderFindUniqueMock = jest.fn();
  const txOrderUpdateMock = jest.fn();

  const txUserUpdateMock = jest.fn();
  const txProductUpdateMock = jest.fn();

  const txTokenLogCreateMock = jest.fn();
  const txOrderStatusLogCreateMock = jest.fn();
  const txAdminActionLogCreateMock = jest.fn();

  const transactionMock = jest.fn();

  const transactionClientMock = {
    order: {
      findUnique: txOrderFindUniqueMock,
      update: txOrderUpdateMock,
    },
    user: {
      update: txUserUpdateMock,
    },
    product: {
      update: txProductUpdateMock,
    },
    tokenLog: {
      create: txTokenLogCreateMock,
    },
    orderStatusLog: {
      create: txOrderStatusLogCreateMock,
    },
    adminActionLog: {
      create: txAdminActionLogCreateMock,
    },
  };

  const prismaMock = {
    order: {
      findUnique: rootOrderFindUniqueMock,
    },
    $transaction: transactionMock,
  };

  type TransactionOperation = (
    tx: typeof transactionClientMock,
  ) => Promise<unknown>;

  const executeTransaction = (operation: TransactionOperation) =>
    operation(transactionClientMock);

  const orderedOrder = {
    id: orderId,
    userId,
    productId,
    quantity: 2,
    unitPrice: 100,
    totalAmount: 200,
    status: OrderStatus.ORDERED,
    createdAt: orderedAt,
    acceptedAt: null,
    deliveredAt: null,
    canceledAt: null,
    cancellationReason: null,
    product: {
      id: productId,
      name: 'KSA Hoodie',
      stockQuantity: 8,
    },
    user: {
      id: userId,
      name: 'Sulynn Kim',
      studentNumber: '20912345',
      email: 'user@connect.ust.hk',
      tokenBalance: 300,
    },
  };

  const acceptedOrder = {
    ...orderedOrder,
    status: OrderStatus.ACCEPTED,
    acceptedAt,
  };

  function createResponseOrder(
    status: OrderStatus,
    options?: {
      acceptedAt?: Date | null;
      deliveredAt?: Date | null;
      canceledAt?: Date | null;
      cancellationReason?: string | null;
    },
  ) {
    return {
      id: orderId,
      quantity: 2,
      unitPrice: 100,
      totalAmount: 200,
      status,
      createdAt: orderedAt,
      acceptedAt: options?.acceptedAt ?? null,
      deliveredAt: options?.deliveredAt ?? null,
      canceledAt: options?.canceledAt ?? null,
      cancellationReason: options?.cancellationReason ?? null,
      product: {
        id: productId,
        name: 'KSA Hoodie',
      },
      user: {
        id: userId,
        name: 'Sulynn Kim',
        studentNumber: '20912345',
        email: 'user@connect.ust.hk',
      },
    };
  }

  function createPrismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Prisma test error', {
      code,
      clientVersion: 'test',
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(statusChangedAt);

    service = new OrdersService(prismaMock as unknown as PrismaService);

    transactionMock.mockImplementation(executeTransaction);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should accept an ordered order', async () => {
    txOrderFindUniqueMock.mockResolvedValue(orderedOrder);

    const updatedOrder = createResponseOrder(OrderStatus.ACCEPTED, {
      acceptedAt: statusChangedAt,
    });

    txOrderUpdateMock.mockResolvedValue(updatedOrder);

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
        },
        adminId,
      ),
    ).resolves.toEqual({
      orderId,
      product: {
        productId,
        productName: 'KSA Hoodie',
      },
      customer: {
        userId,
        customerName: 'Sulynn Kim',
        studentNumber: '20912345',
        email: 'user@connect.ust.hk',
      },
      quantity: 2,
      unitPrice: 100,
      totalAmount: 200,
      orderStatus: 'accepted',
      orderedAt,
      acceptedAt: statusChangedAt,
      deliveredAt: null,
      canceledAt: null,
      cancellationReason: null,
    });

    expect(txOrderUpdateMock).toHaveBeenCalledWith({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.ACCEPTED,
        acceptedAt: statusChangedAt,
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
        user: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            email: true,
          },
        },
      },
    });

    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();

    expect(txOrderStatusLogCreateMock).toHaveBeenCalledWith({
      data: {
        changedBy: adminId,
        orderId,
        beforeStatus: OrderStatus.ORDERED,
        afterStatus: OrderStatus.ACCEPTED,
      },
    });

    expect(txAdminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.ORDER,
        action: AdminAction.UPDATE_ORDER_STATUS,
        targetId: orderId,
        metadata: {
          beforeStatus: 'ordered',
          afterStatus: 'accepted',
        },
      },
    });
  });

  it('should deliver an accepted order and preserve acceptedAt', async () => {
    txOrderFindUniqueMock.mockResolvedValue(acceptedOrder);

    const updatedOrder = createResponseOrder(OrderStatus.DELIVERED, {
      acceptedAt,
      deliveredAt: statusChangedAt,
    });

    txOrderUpdateMock.mockResolvedValue(updatedOrder);

    const result = await service.updateOrderStatus(
      orderId,
      {
        orderStatus: 'delivered',
      },
      adminId,
    );

    expect(result).toMatchObject({
      orderStatus: 'delivered',
      acceptedAt,
      deliveredAt: statusChangedAt,
      canceledAt: null,
      cancellationReason: null,
    });

    expect(txOrderUpdateMock).toHaveBeenCalledWith({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.DELIVERED,
        deliveredAt: statusChangedAt,
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
        user: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            email: true,
          },
        },
      },
    });

    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();

    expect(txOrderStatusLogCreateMock).toHaveBeenCalledWith({
      data: {
        changedBy: adminId,
        orderId,
        beforeStatus: OrderStatus.ACCEPTED,
        afterStatus: OrderStatus.DELIVERED,
      },
    });
  });

  it('should cancel an ordered order, refund tokens, and restore stock', async () => {
    txOrderFindUniqueMock.mockResolvedValue(orderedOrder);

    txUserUpdateMock.mockResolvedValue({
      tokenBalance: 500,
    });

    txProductUpdateMock.mockResolvedValue({
      id: productId,
    });

    const updatedOrder = createResponseOrder(OrderStatus.CANCELED, {
      canceledAt: statusChangedAt,
      cancellationReason: 'Item is no longer available',
    });

    txOrderUpdateMock.mockResolvedValue(updatedOrder);

    const result = await service.updateOrderStatus(
      orderId,
      {
        orderStatus: 'canceled',
        cancellationReason: '  Item is no longer available  ',
      },
      adminId,
    );

    expect(result).toMatchObject({
      orderStatus: 'canceled',
      acceptedAt: null,
      deliveredAt: null,
      canceledAt: statusChangedAt,
      cancellationReason: 'Item is no longer available',
    });

    expect(txUserUpdateMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      data: {
        tokenBalance: {
          increment: 200,
        },
      },
      select: {
        tokenBalance: true,
      },
    });

    expect(txProductUpdateMock).toHaveBeenCalledWith({
      where: {
        id: productId,
      },
      data: {
        stockQuantity: {
          increment: 2,
        },
      },
    });

    expect(txTokenLogCreateMock).toHaveBeenCalledWith({
      data: {
        transactionType: TokenTransactionType.ORDER_REFUND,
        adminId: null,
        userId,
        tokenGrantId: null,
        orderId,
        balanceBefore: 300,
        balanceAfter: 500,
        delta: 200,
        reason: 'Order refund - KSA Hoodie',
      },
    });

    expect(txOrderUpdateMock).toHaveBeenCalledWith({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.CANCELED,
        canceledAt: statusChangedAt,
        cancellationReason: 'Item is no longer available',
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
        user: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            email: true,
          },
        },
      },
    });

    expect(txOrderStatusLogCreateMock).toHaveBeenCalledWith({
      data: {
        changedBy: adminId,
        orderId,
        beforeStatus: OrderStatus.ORDERED,
        afterStatus: OrderStatus.CANCELED,
      },
    });

    expect(txAdminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.ORDER,
        action: AdminAction.UPDATE_ORDER_STATUS,
        targetId: orderId,
        metadata: {
          beforeStatus: 'ordered',
          afterStatus: 'canceled',
          cancellationReason: 'Item is no longer available',
        },
      },
    });
  });

  it('should preserve acceptedAt when canceling an accepted order', async () => {
    txOrderFindUniqueMock.mockResolvedValue(acceptedOrder);

    txUserUpdateMock.mockResolvedValue({
      tokenBalance: 500,
    });

    txProductUpdateMock.mockResolvedValue({
      id: productId,
    });

    txOrderUpdateMock.mockResolvedValue(
      createResponseOrder(OrderStatus.CANCELED, {
        acceptedAt,
        canceledAt: statusChangedAt,
        cancellationReason: 'Customer request',
      }),
    );

    const result = await service.updateOrderStatus(
      orderId,
      {
        orderStatus: 'canceled',
        cancellationReason: 'Customer request',
      },
      adminId,
    );

    expect(result).toMatchObject({
      orderStatus: 'canceled',
      acceptedAt,
      canceledAt: statusChangedAt,
      cancellationReason: 'Customer request',
    });

    expect(txOrderStatusLogCreateMock).toHaveBeenCalledWith({
      data: {
        changedBy: adminId,
        orderId,
        beforeStatus: OrderStatus.ACCEPTED,
        afterStatus: OrderStatus.CANCELED,
      },
    });
  });

  it('should reject cancellation without a reason', async () => {
    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'canceled',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'O400_CANCELLATION_REASON_REQUIRED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a whitespace-only cancellation reason', async () => {
    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'canceled',
          cancellationReason: '   ',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'O400_CANCELLATION_REASON_REQUIRED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a cancellation reason for a non-cancel status', async () => {
    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
          cancellationReason: 'Not allowed',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'O400_CANCELLATION_REASON_NOT_ALLOWED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should return not found when the order does not exist', async () => {
    txOrderFindUniqueMock.mockResolvedValue(null);

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'O404_ORDER_NOT_FOUND',
      },
    });

    expect(txOrderUpdateMock).not.toHaveBeenCalled();
  });

  it('should reject ORDERED -> DELIVERED', async () => {
    txOrderFindUniqueMock.mockResolvedValue(orderedOrder);

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'delivered',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_INVALID_ORDER_STATUS_TRANSITION',
      },
    });

    expect(txOrderUpdateMock).not.toHaveBeenCalled();
    expect(txOrderStatusLogCreateMock).not.toHaveBeenCalled();
    expect(txAdminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a transition from delivered to accepted', async () => {
    txOrderFindUniqueMock.mockResolvedValue({
      ...acceptedOrder,
      status: OrderStatus.DELIVERED,
      deliveredAt: acceptedAt,
    });

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_INVALID_ORDER_STATUS_TRANSITION',
      },
    });
  });

  it('should return accepted as a no-op when the order is already accepted', async () => {
    txOrderFindUniqueMock.mockResolvedValue(acceptedOrder);

    const result = await service.updateOrderStatus(
      orderId,
      {
        orderStatus: 'accepted',
      },
      adminId,
    );

    expect(result).toMatchObject({
      orderStatus: 'accepted',
      acceptedAt,
    });

    expect(txOrderUpdateMock).not.toHaveBeenCalled();
    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();
    expect(txOrderStatusLogCreateMock).not.toHaveBeenCalled();
    expect(txAdminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return delivered as a no-op when the order is already delivered', async () => {
    txOrderFindUniqueMock.mockResolvedValue({
      ...acceptedOrder,
      status: OrderStatus.DELIVERED,
      deliveredAt: statusChangedAt,
    });

    const result = await service.updateOrderStatus(
      orderId,
      {
        orderStatus: 'delivered',
      },
      adminId,
    );

    expect(result).toMatchObject({
      orderStatus: 'delivered',
      acceptedAt,
      deliveredAt: statusChangedAt,
    });

    expect(txOrderUpdateMock).not.toHaveBeenCalled();
    expect(txOrderStatusLogCreateMock).not.toHaveBeenCalled();
    expect(txAdminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return canceled as a no-op for the same cancellation reason', async () => {
    txOrderFindUniqueMock.mockResolvedValue({
      ...orderedOrder,
      status: OrderStatus.CANCELED,
      canceledAt: statusChangedAt,
      cancellationReason: 'Item unavailable',
    });

    const result = await service.updateOrderStatus(
      orderId,
      {
        orderStatus: 'canceled',
        cancellationReason: 'Item unavailable',
      },
      adminId,
    );

    expect(result).toMatchObject({
      orderStatus: 'canceled',
      canceledAt: statusChangedAt,
      cancellationReason: 'Item unavailable',
    });

    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();
    expect(txOrderUpdateMock).not.toHaveBeenCalled();
    expect(txOrderStatusLogCreateMock).not.toHaveBeenCalled();
    expect(txAdminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a repeated cancellation with a different reason', async () => {
    txOrderFindUniqueMock.mockResolvedValue({
      ...orderedOrder,
      status: OrderStatus.CANCELED,
      canceledAt: statusChangedAt,
      cancellationReason: 'Item unavailable',
    });

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'canceled',
          cancellationReason: 'Customer request',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_ORDER_CANCELLATION_CONFLICT',
      },
    });

    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a refund that would overflow the token balance', async () => {
    txOrderFindUniqueMock.mockResolvedValue({
      ...orderedOrder,
      user: {
        ...orderedOrder.user,
        tokenBalance: 2_147_483_448,
      },
    });

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'canceled',
          cancellationReason: 'Item unavailable',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_TOKEN_BALANCE_OVERFLOW',
      },
    });

    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
  });

  it('should reject stock restoration that would overflow product stock', async () => {
    txOrderFindUniqueMock.mockResolvedValue({
      ...orderedOrder,
      product: {
        ...orderedOrder.product,
        stockQuantity: 2_147_483_646,
      },
    });

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'canceled',
          cancellationReason: 'Item unavailable',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_PRODUCT_STOCK_OVERFLOW',
      },
    });

    expect(txUserUpdateMock).not.toHaveBeenCalled();
    expect(txProductUpdateMock).not.toHaveBeenCalled();
  });

  it('should retry the status update after a serializable transaction conflict', async () => {
    txOrderFindUniqueMock.mockResolvedValue(orderedOrder);

    txOrderUpdateMock.mockResolvedValue(
      createResponseOrder(OrderStatus.ACCEPTED, {
        acceptedAt: statusChangedAt,
      }),
    );

    transactionMock
      .mockRejectedValueOnce(createPrismaError('P2034'))
      .mockImplementationOnce(executeTransaction);

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
        },
        adminId,
      ),
    ).resolves.toMatchObject({
      orderStatus: 'accepted',
    });

    expect(transactionMock).toHaveBeenCalledTimes(2);
  });

  it('should return a conflict after exhausting transaction retries', async () => {
    transactionMock.mockRejectedValue(createPrismaError('P2034'));

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_ORDER_CONCURRENT_UPDATE',
      },
    });

    expect(transactionMock).toHaveBeenCalledTimes(3);
  });

  it('should recover from a concurrent duplicate refund using the committed canceled order', async () => {
    const cancellationReason = 'Item unavailable';

    transactionMock.mockRejectedValueOnce(createPrismaError('P2002'));

    rootOrderFindUniqueMock.mockResolvedValue(
      createResponseOrder(OrderStatus.CANCELED, {
        canceledAt: statusChangedAt,
        cancellationReason,
      }),
    );

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'canceled',
          cancellationReason,
        },
        adminId,
      ),
    ).resolves.toMatchObject({
      orderId,
      orderStatus: 'canceled',
      canceledAt: statusChangedAt,
      cancellationReason,
    });

    expect(rootOrderFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: orderId,
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
        user: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            email: true,
          },
        },
      },
    });
  });

  it('should convert an unexpected database failure into the status update error', async () => {
    transactionMock.mockRejectedValue(new Error('Unexpected database failure'));

    await expect(
      service.updateOrderStatus(
        orderId,
        {
          orderStatus: 'accepted',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'O500_ORDER_STATUS_UPDATE_FAILED',
        message: 'Failed to update order status',
      },
    });
  });
});
