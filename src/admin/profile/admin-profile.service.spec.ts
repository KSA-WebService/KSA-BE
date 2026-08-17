import { UserRole, UserStatus } from '@prisma/client';

import {
  UserRoleValue,
  UserStatusValue,
} from '../../common/constants/user-api-values';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminProfileService } from './admin-profile.service';

describe('AdminProfileService', () => {
  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const userFindFirstMock = jest.fn();

  const prismaServiceMock = {
    user: {
      findFirst: userFindFirstMock,
    },
  };

  let service: AdminProfileService;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new AdminProfileService(
      prismaServiceMock as unknown as PrismaService,
    );
  });

  it('should return the active administrator profile', async () => {
    userFindFirstMock.mockResolvedValue({
      id: adminId,
      name: 'KSA Administrator',
      email: 'admin@connect.ust.hk',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    await expect(service.findMe(adminId)).resolves.toEqual({
      userId: adminId,
      name: 'KSA Administrator',
      email: 'admin@connect.ust.hk',
      role: UserRoleValue.ADMIN,
      status: UserStatusValue.ACTIVE,
    });

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: adminId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });
  });

  it('should reject a user without active administrator access', async () => {
    userFindFirstMock.mockResolvedValue(null);

    await expect(service.findMe(adminId)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ADMIN_ACCESS_REQUIRED',
        message: 'Active admin access is required',
      },
    });

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: adminId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });
  });
});
