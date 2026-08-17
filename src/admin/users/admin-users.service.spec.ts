import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  UserRole,
  UserStatus,
} from '@prisma/client';

import {
  USER_ROLE_VALUE_MAP,
  USER_STATUS_VALUE_MAP,
} from '../../common/constants/user-api-values';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminUserSortField,
  GetAdminUsersQueryDto,
} from './dto/get-admin-users-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;

  const userFindManyMock = jest.fn();
  const userCountMock = jest.fn();
  const userFindFirstMock = jest.fn();

  const transactionUserFindFirstMock = jest.fn();
  const transactionUserUpdateMock = jest.fn();
  const transactionAdminActionLogCreateMock = jest.fn();

  const transactionClientMock = {
    user: {
      findFirst: transactionUserFindFirstMock,
      update: transactionUserUpdateMock,
    },
    adminActionLog: {
      create: transactionAdminActionLogCreateMock,
    },
  };

  const transactionMock = jest.fn();

  const prismaServiceMock = {
    user: {
      findMany: userFindManyMock,
      count: userCountMock,
      findFirst: userFindFirstMock,
    },
    $transaction: transactionMock,
  };

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const userId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const createdAt = new Date('2026-08-01T03:00:00.000Z');
  const updatedAt = new Date('2026-08-10T03:00:00.000Z');

  const baseUser = {
    id: userId,
    name: 'HKUST Student',
    studentNumber: '20912345',
    email: 'student@connect.ust.hk',
    role: UserRole.STUDENT,
    tokenBalance: 10,
    status: UserStatus.ACTIVE,
    agreedPrivacy: true,
    agreedAt: new Date('2026-08-01T02:00:00.000Z'),
    createdAt,
    updatedAt,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(
      async (
        argument:
          | Promise<unknown>[]
          | ((tx: typeof transactionClientMock) => Promise<unknown>),
      ) => {
        if (Array.isArray(argument)) {
          return Promise.all(argument);
        }

        return argument(transactionClientMock);
      },
    );

    service = new AdminUsersService(
      prismaServiceMock as unknown as PrismaService,
    );
  });

  describe('findAll', () => {
    it('should return filtered non-deleted users with stable pagination and API values', async () => {
      const query = {
        page: 2,
        limit: 10,
        keyword: 'student',
        role: USER_ROLE_VALUE_MAP[UserRole.STUDENT],
        status: USER_STATUS_VALUE_MAP[UserStatus.ACTIVE],
        sort: AdminUserSortField.CREATED_AT,
        order: 'desc',
      } as GetAdminUsersQueryDto;

      userFindManyMock.mockResolvedValue([
        {
          id: baseUser.id,
          name: baseUser.name,
          studentNumber: baseUser.studentNumber,
          email: baseUser.email,
          role: baseUser.role,
          tokenBalance: baseUser.tokenBalance,
          status: baseUser.status,
          createdAt: baseUser.createdAt,
        },
      ]);

      userCountMock.mockResolvedValue(11);

      const result = await service.findAll(query);

      expect(userFindManyMock).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          OR: [
            {
              name: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
            {
              studentNumber: {
                contains: query.keyword,
              },
            },
          ],
        },
        skip: 10,
        take: 10,
        orderBy: [
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
        select: {
          id: true,
          name: true,
          studentNumber: true,
          email: true,
          role: true,
          tokenBalance: true,
          status: true,
          createdAt: true,
        },
      });

      expect(userCountMock).toHaveBeenCalledWith({
        where: {
          deletedAt: null,
          role: UserRole.STUDENT,
          status: UserStatus.ACTIVE,
          OR: [
            {
              name: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: query.keyword,
                mode: 'insensitive',
              },
            },
            {
              studentNumber: {
                contains: query.keyword,
              },
            },
          ],
        },
      });

      expect(result).toEqual({
        items: [
          {
            userId,
            name: baseUser.name,
            studentNumber: baseUser.studentNumber,
            email: baseUser.email,
            role: 'student',
            tokenBalance: baseUser.tokenBalance,
            status: 'active',
            createdAt,
          },
        ],
        pagination: {
          page: 2,
          limit: 10,
          total: 11,
          totalPages: 2,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a non-deleted user with API role and status values', async () => {
      userFindFirstMock.mockResolvedValue(baseUser);

      const result = await service.findOne(userId);

      expect(userFindFirstMock).toHaveBeenCalledWith({
        where: {
          id: userId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          studentNumber: true,
          email: true,
          role: true,
          tokenBalance: true,
          status: true,
          agreedPrivacy: true,
          agreedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      expect(result).toEqual({
        userId,
        name: baseUser.name,
        studentNumber: baseUser.studentNumber,
        email: baseUser.email,
        role: 'student',
        tokenBalance: baseUser.tokenBalance,
        status: 'active',
        agreedPrivacy: baseUser.agreedPrivacy,
        agreedAt: baseUser.agreedAt,
        createdAt,
        updatedAt,
      });
    });

    it('should return not found when no non-deleted user exists', async () => {
      userFindFirstMock.mockResolvedValue(null);

      let caughtError: unknown;

      try {
        await service.findOne(userId);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(NotFoundException);

      expect((caughtError as NotFoundException).getResponse()).toEqual({
        errorCode: 'U404_USER_NOT_FOUND',
        message: 'User not found',
        data: {
          userId,
        },
      });
    });
  });

  describe('update', () => {
    it('should reject an update when neither role nor status is provided', async () => {
      const dto = {} as UpdateAdminUserDto;

      let caughtError: unknown;

      try {
        await service.update(userId, dto, adminId);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(BadRequestException);

      expect((caughtError as BadRequestException).getResponse()).toEqual({
        errorCode: 'U400_USER_UPDATE_REQUIRED',
        message: 'At least one of role or status must be provided',
        data: null,
      });

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should not update or create audit logs when requested values are unchanged', async () => {
      transactionUserFindFirstMock.mockResolvedValue(baseUser);

      const dto: UpdateAdminUserDto = {
        role: USER_ROLE_VALUE_MAP[UserRole.STUDENT],
        status: USER_STATUS_VALUE_MAP[UserStatus.ACTIVE],
      };

      const result = await service.update(userId, dto, adminId);

      expect(transactionUserUpdateMock).not.toHaveBeenCalled();
      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();

      expect(result).toEqual({
        userId,
        name: baseUser.name,
        studentNumber: baseUser.studentNumber,
        email: baseUser.email,
        role: 'student',
        tokenBalance: baseUser.tokenBalance,
        status: 'active',
        agreedPrivacy: baseUser.agreedPrivacy,
        agreedAt: baseUser.agreedAt,
        createdAt,
        updatedAt,
      });
    });

    it('should prevent an administrator from demoting their own account', async () => {
      const currentAdmin = {
        ...baseUser,
        id: adminId,
        role: UserRole.ADMIN,
      };

      transactionUserFindFirstMock.mockResolvedValue(currentAdmin);

      const dto: UpdateAdminUserDto = {
        role: USER_ROLE_VALUE_MAP[UserRole.STUDENT],
      };

      let caughtError: unknown;

      try {
        await service.update(adminId, dto, adminId);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);

      expect((caughtError as ForbiddenException).getResponse()).toEqual({
        errorCode: 'U403_SELF_ROLE_CHANGE_NOT_ALLOWED',
        message: 'Administrators cannot demote their own account',
        data: {
          userId: adminId,
        },
      });

      expect(transactionUserUpdateMock).not.toHaveBeenCalled();
      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
    });

    it('should prevent an administrator from blocking their own account', async () => {
      const currentAdmin = {
        ...baseUser,
        id: adminId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      };

      transactionUserFindFirstMock.mockResolvedValue(currentAdmin);

      const dto: UpdateAdminUserDto = {
        status: USER_STATUS_VALUE_MAP[UserStatus.BLOCKED],
      };

      let caughtError: unknown;

      try {
        await service.update(adminId, dto, adminId);
      } catch (error: unknown) {
        caughtError = error;
      }

      expect(caughtError).toBeInstanceOf(ForbiddenException);

      expect((caughtError as ForbiddenException).getResponse()).toEqual({
        errorCode: 'U403_SELF_BLOCK_NOT_ALLOWED',
        message: 'Administrators cannot block their own account',
        data: {
          userId: adminId,
        },
      });

      expect(transactionUserUpdateMock).not.toHaveBeenCalled();
      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
    });

    it('should update role and status and create separate audit logs', async () => {
      transactionUserFindFirstMock.mockResolvedValue(baseUser);

      const updatedUser = {
        ...baseUser,
        role: UserRole.ADMIN,
        status: UserStatus.BLOCKED,
        updatedAt: new Date('2026-08-17T03:00:00.000Z'),
      };

      transactionUserUpdateMock.mockResolvedValue(updatedUser);

      transactionAdminActionLogCreateMock
        .mockResolvedValueOnce({
          id: 1,
        })
        .mockResolvedValueOnce({
          id: 2,
        });

      const dto: UpdateAdminUserDto = {
        role: USER_ROLE_VALUE_MAP[UserRole.ADMIN],
        status: USER_STATUS_VALUE_MAP[UserStatus.BLOCKED],
      };

      const result = await service.update(userId, dto, adminId);

      expect(transactionUserUpdateMock).toHaveBeenCalledWith({
        where: {
          id: userId,
        },
        data: {
          role: UserRole.ADMIN,
          status: UserStatus.BLOCKED,
        },
        select: {
          id: true,
          name: true,
          studentNumber: true,
          email: true,
          role: true,
          tokenBalance: true,
          status: true,
          agreedPrivacy: true,
          agreedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      expect(transactionAdminActionLogCreateMock).toHaveBeenNthCalledWith(1, {
        data: {
          adminId,
          actionType: AdminActionType.USER,
          action: AdminAction.UPDATE_USER_ROLE,
          targetId: userId,
          metadata: {
            beforeRole: UserRole.STUDENT,
            afterRole: UserRole.ADMIN,
          },
        },
      });

      expect(transactionAdminActionLogCreateMock).toHaveBeenNthCalledWith(2, {
        data: {
          adminId,
          actionType: AdminActionType.USER,
          action: AdminAction.UPDATE_USER_STATUS,
          targetId: userId,
          metadata: {
            beforeStatus: UserStatus.ACTIVE,
            afterStatus: UserStatus.BLOCKED,
          },
        },
      });

      expect(result).toEqual({
        userId,
        name: updatedUser.name,
        studentNumber: updatedUser.studentNumber,
        email: updatedUser.email,
        role: 'admin',
        tokenBalance: updatedUser.tokenBalance,
        status: 'blocked',
        agreedPrivacy: updatedUser.agreedPrivacy,
        agreedAt: updatedUser.agreedAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
    });
  });
});
