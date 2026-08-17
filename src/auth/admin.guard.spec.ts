import { ExecutionContext } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AdminGuard } from './admin.guard';

describe('AdminGuard', () => {
  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const userFindUniqueMock = jest.fn();

  const prismaServiceMock = {
    user: {
      findUnique: userFindUniqueMock,
    },
  };

  let guard: AdminGuard;

  const createContext = (authenticatedUserId?: string) => {
    const request: {
      user?: {
        id?: string;
      };
    } = {};

    if (authenticatedUserId !== undefined) {
      request.user = {
        id: authenticatedUserId,
      };
    }

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return {
      context,
      request,
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    guard = new AdminGuard(prismaServiceMock as unknown as PrismaService);
  });

  it('should reject a request without authenticated user information', async () => {
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: {
        errorCode: 'A401_AUTHENTICATION_REQUIRED',
        message: 'Authenticated user information is missing',
      },
    });

    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it('should reject an authenticated user that does not exist', async () => {
    const { context } = createContext(userId);

    userFindUniqueMock.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ADMIN_ACCESS_REQUIRED',
        message: 'Active admin access is required',
      },
    });

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      select: {
        role: true,
        status: true,
        deletedAt: true,
      },
    });
  });

  it('should reject a non-admin user', async () => {
    const { context } = createContext(userId);

    userFindUniqueMock.mockResolvedValue({
      role: UserRole.STUDENT,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ADMIN_ACCESS_REQUIRED',
        message: 'Active admin access is required',
      },
    });
  });

  it('should reject an inactive admin user', async () => {
    const { context } = createContext(userId);

    userFindUniqueMock.mockResolvedValue({
      role: UserRole.ADMIN,
      status: UserStatus.BLOCKED,
      deletedAt: null,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ADMIN_ACCESS_REQUIRED',
        message: 'Active admin access is required',
      },
    });
  });

  it('should reject a soft-deleted admin user', async () => {
    const { context } = createContext(userId);

    userFindUniqueMock.mockResolvedValue({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: new Date('2026-08-17T00:00:00.000Z'),
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ADMIN_ACCESS_REQUIRED',
        message: 'Active admin access is required',
      },
    });
  });

  it('should allow an active non-deleted admin user', async () => {
    const { context } = createContext(userId);

    userFindUniqueMock.mockResolvedValue({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      select: {
        role: true,
        status: true,
        deletedAt: true,
      },
    });
  });
});
