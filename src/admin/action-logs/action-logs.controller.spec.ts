import { ActionLogsController } from './action-logs.controller';
import { ActionLogsService } from './action-logs.service';
import { GetAdminActionLogsQueryDto } from './dto/get-admin-action-logs-query.dto';

describe('ActionLogsController', () => {
  const getActionLogsMock = jest.fn();
  const getActionLogDetailMock = jest.fn();

  const actionLogsServiceMock = {
    getActionLogs: getActionLogsMock,
    getActionLogDetail: getActionLogDetailMock,
  };

  let controller: ActionLogsController;

  beforeEach(() => {
    jest.resetAllMocks();

    controller = new ActionLogsController(
      actionLogsServiceMock as unknown as ActionLogsService,
    );
  });

  it('should forward the query to the service', async () => {
    const query: GetAdminActionLogsQueryDto = {
      page: 2,
      limit: 20,
      actionType: 'order',
      adminId: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
      sort: 'oldest',
    };

    const expected = {
      items: [],
      pagination: {
        page: 2,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };

    getActionLogsMock.mockResolvedValue(expected);

    await expect(controller.getActionLogs(query)).resolves.toEqual(expected);

    expect(getActionLogsMock).toHaveBeenCalledTimes(1);

    expect(getActionLogsMock).toHaveBeenCalledWith(query);
  });

  it('should forward the log ID to the detail service', async () => {
    const expected = {
      logId: 152,
      admin: {
        userId: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
        name: 'Sulynn Kim',
        email: 'admin@connect.ust.hk',
      },
      actionType: 'order',
      action: 'update_order_status',
      targetId: 'b109f280-e709-4093-9cb8-054972f305fe',
      createdAt: new Date('2026-08-11T14:01:16.048Z'),
      details: {
        beforeStatus: 'ordered',
        afterStatus: 'canceled',
        cancellationReason: 'Test cancellation',
      },
    };

    getActionLogDetailMock.mockResolvedValue(expected);

    await expect(
      controller.getActionLogDetail({
        logId: 152,
      }),
    ).resolves.toEqual(expected);

    expect(getActionLogDetailMock).toHaveBeenCalledTimes(1);

    expect(getActionLogDetailMock).toHaveBeenCalledWith(152);
  });
});
