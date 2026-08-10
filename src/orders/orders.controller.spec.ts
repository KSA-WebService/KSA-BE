import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrdersController', () => {
  let controller: OrdersController;

  const createOrderMock = jest.fn();

  const ordersServiceMock = {
    createOrder: createOrderMock,
  };

  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';
  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';
  const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

  const request = {
    user: {
      id: userId,
    },
  };

  const body: CreateOrderDto = {
    productId,
    quantity: 2,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new OrdersController(
      ordersServiceMock as unknown as OrdersService,
    );
  });

  it('should pass the authenticated user and idempotency key to the service', async () => {
    const expected = {
      orderId: '6c1e9d2a-1234-4c11-9f10-abc123456789',
      product: {
        productId,
        productName: 'KSA Hoodie',
      },
      quantity: 2,
      unitPrice: 150,
      totalAmount: 300,
      orderStatus: 'ordered',
      remainingTokenBalance: 200,
      orderedAt: new Date('2026-08-11T00:00:00.000Z'),
    };

    createOrderMock.mockResolvedValue(expected);

    await expect(
      controller.createOrder(body, idempotencyKey, request),
    ).resolves.toEqual(expected);

    expect(createOrderMock).toHaveBeenCalledTimes(1);

    expect(createOrderMock).toHaveBeenCalledWith(body, userId, idempotencyKey);
  });

  it('should reject a missing idempotency key', async () => {
    await expect(
      controller.createOrder(body, undefined, request),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'O400_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      },
    });

    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('should reject a blank idempotency key', async () => {
    await expect(
      controller.createOrder(body, '   ', request),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'O400_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required',
      },
    });

    expect(createOrderMock).not.toHaveBeenCalled();
  });

  it('should reject an invalid idempotency key', async () => {
    await expect(
      controller.createOrder(body, 'invalid-key', request),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'O400_IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be a valid UUID v4',
      },
    });

    expect(createOrderMock).not.toHaveBeenCalled();
  });
});
