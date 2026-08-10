import {
  OrderStatus,
  Prisma,
  PublicationStatus,
  TokenTransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
  const otherUserId = 'a8d91c2e-2222-4a11-9f10-abc123456789';
  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';
  const otherProductId = '8a7b9c2d-5678-4d22-8e20-def987654321';
  const orderId = '6c1e9d2a-1234-4c11-9f10-abc123456789';
  const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

  const orderedAt = new Date('2026-08-11T00:00:00.000Z');

  const dto: CreateOrderDto = {
    productId,
    quantity: 2,
  };

  const rootOrderFindUniqueMock = jest.fn();
  const transactionMock = jest.fn();

  const txOrderFindUniqueMock = jest.fn();
  const txOrderCreateMock = jest.fn();

  const txUserFindUniqueMock = jest.fn();
  const txUserUpdateManyMock = jest.fn();

  const txProductFindUniqueMock = jest.fn();
  const txProductUpdateManyMock = jest.fn();

  const txTokenLogCreateMock = jest.fn();

  const transactionClientMock = {
    order: {
      findUnique: txOrderFindUniqueMock,
      create: txOrderCreateMock,
    },
    user: {
      findUnique: txUserFindUniqueMock,
      updateMany: txUserUpdateManyMock,
    },
    product: {
      findUnique: txProductFindUniqueMock,
      updateMany: txProductUpdateManyMock,
    },
    tokenLog: {
      create: txTokenLogCreateMock,
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

  const existingOrder = {
    id: orderId,
    userId,
    productId,
    quantity: 2,
    unitPrice: 150,
    totalAmount: 300,
    createdAt: orderedAt,
    product: {
      name: 'KSA Hoodie',
    },
    tokenLogs: [
      {
        balanceAfter: 200,
      },
    ],
  };

  function setupSuccessfulPurchase() {
    txUserFindUniqueMock
      .mockResolvedValueOnce({
        id: userId,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: 500,
      })
      .mockResolvedValueOnce({
        tokenBalance: 200,
      });

    txProductFindUniqueMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      tokenPrice: 150,
      stockQuantity: 10,
      isOrderable: true,
      publicationStatus: PublicationStatus.PUBLISHED,
      deletedAt: null,
    });

    txProductUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    txUserUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    txOrderCreateMock.mockResolvedValue({
      id: orderId,
      quantity: 2,
      unitPrice: 150,
      totalAmount: 300,
      createdAt: orderedAt,
    });

    txTokenLogCreateMock.mockResolvedValue({
      id: '7e1e9d2a-1234-4c11-9f10-abc123456789',
    });
  }

  function createPrismaError(code: string) {
    return new Prisma.PrismaClientKnownRequestError('Prisma test error', {
      code,
      clientVersion: 'test',
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();

    service = new OrdersService(prismaMock as unknown as PrismaService);

    rootOrderFindUniqueMock.mockResolvedValue(null);
    txOrderFindUniqueMock.mockResolvedValue(null);

    transactionMock.mockImplementation(executeTransaction);
  });

  it('should create an order, deduct stock and tokens, and create the payment log', async () => {
    setupSuccessfulPurchase();

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).resolves.toEqual({
      orderId,
      product: {
        productId,
        productName: 'KSA Hoodie',
      },
      quantity: 2,
      unitPrice: 150,
      totalAmount: 300,
      orderStatus: 'ordered',
      remainingTokenBalance: 200,
      orderedAt,
    });

    expect(txProductUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: productId,
        deletedAt: null,
        publicationStatus: PublicationStatus.PUBLISHED,
        isOrderable: true,
        stockQuantity: {
          gte: 2,
        },
      },
      data: {
        stockQuantity: {
          decrement: 2,
        },
      },
    });

    expect(txUserUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: userId,
        role: UserRole.STUDENT,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        tokenBalance: {
          gte: 300,
        },
      },
      data: {
        tokenBalance: {
          decrement: 300,
        },
      },
    });

    expect(txOrderCreateMock).toHaveBeenCalledWith({
      data: {
        userId,
        productId,
        idempotencyKey,
        quantity: 2,
        unitPrice: 150,
        totalAmount: 300,
        status: OrderStatus.ORDERED,
      },
      select: {
        id: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        createdAt: true,
      },
    });

    expect(txTokenLogCreateMock).toHaveBeenCalledWith({
      data: {
        transactionType: TokenTransactionType.ORDER_PAYMENT,
        adminId: null,
        userId,
        tokenGrantId: null,
        orderId,
        balanceBefore: 500,
        balanceAfter: 200,
        delta: -300,
        reason: 'Order payment - KSA Hoodie',
      },
    });

    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('should return the original result for the same idempotent request', async () => {
    rootOrderFindUniqueMock.mockResolvedValue(existingOrder);

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).resolves.toEqual({
      orderId,
      product: {
        productId,
        productName: 'KSA Hoodie',
      },
      quantity: 2,
      unitPrice: 150,
      totalAmount: 300,
      orderStatus: 'ordered',
      remainingTokenBalance: 200,
      orderedAt,
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(txProductUpdateManyMock).not.toHaveBeenCalled();
    expect(txUserUpdateManyMock).not.toHaveBeenCalled();
    expect(txOrderCreateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject reuse of an idempotency key with a different quantity', async () => {
    rootOrderFindUniqueMock.mockResolvedValue(existingOrder);

    await expect(
      service.createOrder(
        {
          productId,
          quantity: 3,
        },
        userId,
        idempotencyKey,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_IDEMPOTENCY_KEY_REUSED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject reuse of an idempotency key with a different product', async () => {
    rootOrderFindUniqueMock.mockResolvedValue(existingOrder);

    await expect(
      service.createOrder(
        {
          productId: otherProductId,
          quantity: 2,
        },
        userId,
        idempotencyKey,
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_IDEMPOTENCY_KEY_REUSED',
      },
    });
  });

  it('should reject an idempotency key belonging to another user', async () => {
    rootOrderFindUniqueMock.mockResolvedValue(existingOrder);

    await expect(
      service.createOrder(dto, otherUserId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_IDEMPOTENCY_KEY_REUSED',
      },
    });
  });

  it('should fail if an existing idempotent order has no payment log', async () => {
    rootOrderFindUniqueMock.mockResolvedValue({
      ...existingOrder,
      tokenLogs: [],
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'O500_ORDER_CREATE_FAILED',
      },
    });
  });

  it('should reject an administrator account', async () => {
    txUserFindUniqueMock.mockResolvedValue({
      id: userId,
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tokenBalance: 500,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'O403_ORDER_NOT_ALLOWED',
      },
    });

    expect(txProductFindUniqueMock).not.toHaveBeenCalled();
    expect(txProductUpdateManyMock).not.toHaveBeenCalled();
    expect(txUserUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should return not found when the product does not exist', async () => {
    txUserFindUniqueMock.mockResolvedValue({
      id: userId,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tokenBalance: 500,
    });

    txProductFindUniqueMock.mockResolvedValue(null);

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'O404_PRODUCT_NOT_FOUND',
      },
    });
  });

  it('should reject a hidden product', async () => {
    txUserFindUniqueMock.mockResolvedValue({
      id: userId,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tokenBalance: 500,
    });

    txProductFindUniqueMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      tokenPrice: 150,
      stockQuantity: 10,
      isOrderable: true,
      publicationStatus: PublicationStatus.HIDDEN,
      deletedAt: null,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_PRODUCT_UNAVAILABLE',
      },
    });

    expect(txProductUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should reject a product with ordering disabled', async () => {
    txUserFindUniqueMock.mockResolvedValue({
      id: userId,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tokenBalance: 500,
    });

    txProductFindUniqueMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      tokenPrice: 150,
      stockQuantity: 10,
      isOrderable: false,
      publicationStatus: PublicationStatus.PUBLISHED,
      deletedAt: null,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_PRODUCT_UNAVAILABLE',
      },
    });

    expect(txProductUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should reject insufficient product stock', async () => {
    txUserFindUniqueMock.mockResolvedValue({
      id: userId,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tokenBalance: 500,
    });

    txProductFindUniqueMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      tokenPrice: 150,
      stockQuantity: 1,
      isOrderable: true,
      publicationStatus: PublicationStatus.PUBLISHED,
      deletedAt: null,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_INSUFFICIENT_STOCK',
      },
    });

    expect(txProductUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should reject insufficient token balance', async () => {
    txUserFindUniqueMock.mockResolvedValue({
      id: userId,
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tokenBalance: 299,
    });

    txProductFindUniqueMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      tokenPrice: 150,
      stockQuantity: 10,
      isOrderable: true,
      publicationStatus: PublicationStatus.PUBLISHED,
      deletedAt: null,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_INSUFFICIENT_TOKENS',
      },
    });

    expect(txProductUpdateManyMock).not.toHaveBeenCalled();
    expect(txUserUpdateManyMock).not.toHaveBeenCalled();
  });

  it('should stop when stock changes during the atomic update', async () => {
    setupSuccessfulPurchase();

    txProductUpdateManyMock.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_PRODUCT_UNAVAILABLE',
      },
    });

    expect(txUserUpdateManyMock).not.toHaveBeenCalled();
    expect(txOrderCreateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should stop when token balance changes during the atomic update', async () => {
    setupSuccessfulPurchase();

    txUserUpdateManyMock.mockResolvedValue({
      count: 0,
    });

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_INSUFFICIENT_TOKENS',
      },
    });

    expect(txOrderCreateMock).not.toHaveBeenCalled();
    expect(txTokenLogCreateMock).not.toHaveBeenCalled();
  });

  it('should retry a serializable transaction after P2034 conflicts', async () => {
    setupSuccessfulPurchase();

    const transactionConflict = createPrismaError('P2034');

    transactionMock
      .mockRejectedValueOnce(transactionConflict)
      .mockRejectedValueOnce(transactionConflict)
      .mockImplementationOnce(executeTransaction);

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).resolves.toMatchObject({
      orderId,
      totalAmount: 300,
      orderStatus: 'ordered',
      remainingTokenBalance: 200,
    });

    expect(transactionMock).toHaveBeenCalledTimes(3);
  });

  it('should return a conflict after exhausting serializable transaction retries', async () => {
    const transactionConflict = createPrismaError('P2034');

    transactionMock.mockRejectedValue(transactionConflict);

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'O409_ORDER_CONCURRENT_UPDATE',
      },
    });

    expect(transactionMock).toHaveBeenCalledTimes(3);
  });

  it('should recover from an idempotency unique-constraint race', async () => {
    rootOrderFindUniqueMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingOrder);

    transactionMock.mockRejectedValueOnce(createPrismaError('P2002'));

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).resolves.toEqual({
      orderId,
      product: {
        productId,
        productName: 'KSA Hoodie',
      },
      quantity: 2,
      unitPrice: 150,
      totalAmount: 300,
      orderStatus: 'ordered',
      remainingTokenBalance: 200,
      orderedAt,
    });

    expect(rootOrderFindUniqueMock).toHaveBeenCalledTimes(2);
  });

  it('should convert an unexpected database error into the order creation error', async () => {
    transactionMock.mockRejectedValue(new Error('Unexpected database failure'));

    await expect(
      service.createOrder(dto, userId, idempotencyKey),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'O500_ORDER_CREATE_FAILED',
        message: 'Failed to create order',
      },
    });
  });
});
