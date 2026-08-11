import { AdminOrdersController } from './admin-orders.controller';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders-query.dto';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;

  const getAdminOrdersMock = jest.fn();
  const updateOrderStatusMock = jest.fn();

  const ordersServiceMock = {
    getAdminOrders: getAdminOrdersMock,
    updateOrderStatus: updateOrderStatusMock,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new AdminOrdersController(
      ordersServiceMock as unknown as OrdersService,
    );
  });

  it('should forward the query to the order service', async () => {
    const query: GetAdminOrdersQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    const expected = {
      items: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };

    getAdminOrdersMock.mockResolvedValue(expected);

    await expect(controller.getOrders(query)).resolves.toEqual(expected);

    expect(getAdminOrdersMock).toHaveBeenCalledTimes(1);
    expect(getAdminOrdersMock).toHaveBeenCalledWith(query);
  });

  it('should forward search, status, pagination, and sorting options', async () => {
    const query: GetAdminOrdersQueryDto = {
      page: 2,
      limit: 10,
      keyword: 'Sulynn',
      orderStatus: 'accepted',
      sort: 'oldest',
    };

    getAdminOrdersMock.mockResolvedValue({
      items: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });

    await controller.getOrders(query);

    expect(getAdminOrdersMock).toHaveBeenCalledWith(query);
  });

  it('should forward an order status update with the authenticated admin ID', async () => {
    const orderId = '6c1e9d2a-1234-4c29-81e6-8faec8fbda53';

    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const body: UpdateOrderStatusDto = {
      orderStatus: 'accepted',
    };

    const request = {
      user: {
        id: adminId,
      },
    };

    const expected = {
      orderId,
      orderStatus: 'accepted',
    };

    updateOrderStatusMock.mockResolvedValue(expected);

    await expect(
      controller.updateOrderStatus(orderId, body, request),
    ).resolves.toEqual(expected);

    expect(updateOrderStatusMock).toHaveBeenCalledTimes(1);

    expect(updateOrderStatusMock).toHaveBeenCalledWith(orderId, body, adminId);
  });

  it('should forward the cancellation reason to the service', async () => {
    const orderId = '6c1e9d2a-1234-4c29-81e6-8faec8fbda53';

    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const body: UpdateOrderStatusDto = {
      orderStatus: 'canceled',
      cancellationReason: 'Item is no longer available',
    };

    const request = {
      user: {
        id: adminId,
      },
    };

    updateOrderStatusMock.mockResolvedValue({
      orderId,
      orderStatus: 'canceled',
    });

    await controller.updateOrderStatus(orderId, body, request);

    expect(updateOrderStatusMock).toHaveBeenCalledWith(orderId, body, adminId);
  });
});
