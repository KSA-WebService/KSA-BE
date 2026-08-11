import { AdminOrdersController } from './admin-orders.controller';
import { GetAdminOrdersQueryDto } from './dto/get-admin-orders-query.dto';
import { OrdersService } from './orders.service';

describe('AdminOrdersController', () => {
  let controller: AdminOrdersController;

  const getAdminOrdersMock = jest.fn();

  const ordersServiceMock = {
    getAdminOrders: getAdminOrdersMock,
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
});
