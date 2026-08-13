import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import {
  USER_ROLE_PRISMA_MAP,
  USER_ROLE_VALUE_MAP,
  USER_STATUS_PRISMA_MAP,
  USER_STATUS_VALUE_MAP,
} from '../../common/constants/user-api-values';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminUserSortField,
  GetAdminUsersQueryDto,
} from './dto/get-admin-users-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

const ADMIN_USER_SORT_PRISMA_FIELD_MAP: Record<
  AdminUserSortField,
  | 'name'
  | 'studentNumber'
  | 'email'
  | 'role'
  | 'tokenBalance'
  | 'status'
  | 'createdAt'
> = {
  [AdminUserSortField.NAME]: 'name',
  [AdminUserSortField.STUDENT_NUMBER]: 'studentNumber',
  [AdminUserSortField.EMAIL]: 'email',
  [AdminUserSortField.ROLE]: 'role',
  [AdminUserSortField.TOKEN_BALANCE]: 'tokenBalance',
  [AdminUserSortField.STATUS]: 'status',
  [AdminUserSortField.CREATED_AT]: 'createdAt',
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetAdminUsersQueryDto) {
    const { page, limit, keyword, role, status, sort, order } = query;

    const skip = (page - 1) * limit;

    const prismaRole = role ? USER_ROLE_PRISMA_MAP[role] : undefined;
    const prismaStatus = status ? USER_STATUS_PRISMA_MAP[status] : undefined;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(prismaRole
        ? {
            role: prismaRole,
          }
        : {}),
      ...(prismaStatus
        ? {
            status: prismaStatus,
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              {
                name: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
              {
                studentNumber: {
                  contains: keyword,
                },
              },
            ],
          }
        : {}),
    };

    const primaryOrderBy = {
      [ADMIN_USER_SORT_PRISMA_FIELD_MAP[sort]]: order,
    } as Prisma.UserOrderByWithRelationInput;

    const [users, totalCount] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          primaryOrderBy,
          {
            id: order,
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
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      items: users.map((user) => ({
        userId: user.id,
        name: user.name,
        studentNumber: user.studentNumber,
        email: user.email,
        role: USER_ROLE_VALUE_MAP[user.role],
        tokenBalance: user.tokenBalance,
        status: USER_STATUS_VALUE_MAP[user.status],
        createdAt: user.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(userId: string) {
    const user = await this.prisma.user.findFirst({
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

    if (!user) {
      throw new NotFoundException({
        errorCode: 'U404_USER_NOT_FOUND',
        message: 'User not found',
        data: {
          userId,
        },
      });
    }

    return {
      userId: user.id,
      name: user.name,
      studentNumber: user.studentNumber,
      email: user.email,
      role: USER_ROLE_VALUE_MAP[user.role],
      tokenBalance: user.tokenBalance,
      status: USER_STATUS_VALUE_MAP[user.status],
      agreedPrivacy: user.agreedPrivacy,
      agreedAt: user.agreedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async update(userId: string, dto: UpdateAdminUserDto, adminId: string) {
    const { role, status } = dto;

    const prismaRole =
      role === undefined ? undefined : USER_ROLE_PRISMA_MAP[role];

    const prismaStatus =
      status === undefined ? undefined : USER_STATUS_PRISMA_MAP[status];

    if (role === undefined && status === undefined) {
      throw new BadRequestException({
        errorCode: 'U400_USER_UPDATE_REQUIRED',
        message: 'At least one of role or status must be provided',
        data: null,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
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

      if (!user) {
        throw new NotFoundException({
          errorCode: 'U404_USER_NOT_FOUND',
          message: 'User not found',
          data: {
            userId,
          },
        });
      }

      const roleChanged = prismaRole !== undefined && prismaRole !== user.role;

      const statusChanged =
        prismaStatus !== undefined && prismaStatus !== user.status;

      /*
       * 요청값이 현재 값과 모두 같으면
       * DB update와 관리자 로그 생성을 하지 않는다.
       */
      if (!roleChanged && !statusChanged) {
        return {
          userId: user.id,
          name: user.name,
          studentNumber: user.studentNumber,
          email: user.email,
          role: USER_ROLE_VALUE_MAP[user.role],
          tokenBalance: user.tokenBalance,
          status: USER_STATUS_VALUE_MAP[user.status],
          agreedPrivacy: user.agreedPrivacy,
          agreedAt: user.agreedAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }

      /*
       * 관리자가 자기 자신의 역할을 STUDENT로 낮추는 것을 막는다.
       */
      if (
        adminId === userId &&
        roleChanged &&
        prismaRole === UserRole.STUDENT
      ) {
        throw new ForbiddenException({
          errorCode: 'U403_SELF_ROLE_CHANGE_NOT_ALLOWED',
          message: 'Administrators cannot demote their own account',
          data: {
            userId,
          },
        });
      }

      /*
       * 관리자가 자기 자신의 계정을 BLOCKED로 변경하는 것을 막는다.
       */
      if (
        adminId === userId &&
        statusChanged &&
        prismaStatus === UserStatus.BLOCKED
      ) {
        throw new ForbiddenException({
          errorCode: 'U403_SELF_BLOCK_NOT_ALLOWED',
          message: 'Administrators cannot block their own account',
          data: {
            userId,
          },
        });
      }

      const updateData: Prisma.UserUpdateInput = {};

      if (roleChanged && prismaRole !== undefined) {
        updateData.role = prismaRole;
      }

      if (statusChanged && prismaStatus !== undefined) {
        updateData.status = prismaStatus;
      }

      const updatedUser = await tx.user.update({
        where: {
          id: userId,
        },
        data: updateData,
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

      if (roleChanged && prismaRole !== undefined) {
        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.USER,
            action: AdminAction.UPDATE_USER_ROLE,
            targetId: userId,
            metadata: {
              beforeRole: user.role,
              afterRole: prismaRole,
            },
          },
        });
      }

      if (statusChanged && prismaStatus !== undefined) {
        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.USER,
            action: AdminAction.UPDATE_USER_STATUS,
            targetId: userId,
            metadata: {
              beforeStatus: user.status,
              afterStatus: prismaStatus,
            },
          },
        });
      }

      return {
        userId: updatedUser.id,
        name: updatedUser.name,
        studentNumber: updatedUser.studentNumber,
        email: updatedUser.email,
        role: USER_ROLE_VALUE_MAP[updatedUser.role],
        tokenBalance: updatedUser.tokenBalance,
        status: USER_STATUS_VALUE_MAP[updatedUser.status],
        agreedPrivacy: updatedUser.agreedPrivacy,
        agreedAt: updatedUser.agreedAt,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };
    });
  }
}
