import { GetMyOrdersQueryDto } from './dto/get-my-orders-query.dto';
import { OrdersService } from './orders.service';
import { UserOrdersController } from './user-orders.controller';

describe('UserOrdersController', () => {
  let controller: UserOrdersController;

  const getMyOrdersMock = jest.fn();

  const ordersServiceMock = {
    getMyOrders: getMyOrdersMock,
  };

  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new UserOrdersController(
      ordersServiceMock as unknown as OrdersService,
    );
  });

  it('should query orders for the authenticated user', async () => {
    const query: GetMyOrdersQueryDto = {
      page: 1,
      limit: 20,
      sort: 'latest',
    };

    const request = {
      user: {
        id: userId,
      },
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

    getMyOrdersMock.mockResolvedValue(expected);

    await expect(controller.getMyOrders(request, query)).resolves.toEqual(
      expected,
    );

    expect(getMyOrdersMock).toHaveBeenCalledTimes(1);

    expect(getMyOrdersMock).toHaveBeenCalledWith(userId, query);
  });

  it('should forward order status and sorting filters to the service', async () => {
    const query: GetMyOrdersQueryDto = {
      page: 2,
      limit: 10,
      orderStatus: 'canceled',
      sort: 'oldest',
    };

    const request = {
      user: {
        id: userId,
      },
    };

    getMyOrdersMock.mockResolvedValue({
      items: [],
      pagination: {
        page: 2,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });

    await controller.getMyOrders(request, query);

    expect(getMyOrdersMock).toHaveBeenCalledWith(userId, query);
  });
});
