import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AdminActionType, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminActionLogType,
  GetAdminActionLogsQueryDto,
} from './dto/get-admin-action-logs-query.dto';

const ADMIN_ACTION_TYPE_MAP: Record<AdminActionLogType, AdminActionType> = {
  user: AdminActionType.USER,
  whitelist: AdminActionType.WHITELIST,
  invitation: AdminActionType.INVITATION,
  content: AdminActionType.CONTENT,
  product: AdminActionType.PRODUCT,
  order: AdminActionType.ORDER,
  token: AdminActionType.TOKEN,
  file: AdminActionType.FILE,
  memo: AdminActionType.MEMO,
};

@Injectable()
export class ActionLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActionLogs(query: GetAdminActionLogsQueryDto) {
    const { page, limit, actionType, adminId, sort } = query;

    const where: Prisma.AdminActionLogWhereInput = {
      ...(actionType
        ? {
            actionType: ADMIN_ACTION_TYPE_MAP[actionType],
          }
        : {}),
      ...(adminId
        ? {
            adminId,
          }
        : {}),
    };

    const sortDirection = sort === 'oldest' ? 'asc' : 'desc';

    try {
      const [logs, total] = await this.prisma.$transaction([
        this.prisma.adminActionLog.findMany({
          where,
          select: {
            id: true,
            actionType: true,
            action: true,
            targetId: true,
            createdAt: true,
            admin: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: [
            {
              createdAt: sortDirection,
            },
            {
              id: sortDirection,
            },
          ],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.adminActionLog.count({
          where,
        }),
      ]);

      return {
        items: logs.map((log) => ({
          logId: log.id,
          admin: {
            userId: log.admin.id,
            name: log.admin.name,
            email: log.admin.email,
          },
          actionType: log.actionType.toLowerCase(),
          action: log.action.toLowerCase(),
          targetId: log.targetId,
          createdAt: log.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      };
    } catch {
      throw new InternalServerErrorException({
        errorCode: 'AL500_ACTION_LOG_LIST_FETCH_FAILED',
        message: 'Failed to fetch admin action logs',
      });
    }
  }

  async getActionLogDetail(logId: number) {
    try {
      const log = await this.prisma.adminActionLog.findUnique({
        where: {
          id: logId,
        },
        select: {
          id: true,
          actionType: true,
          action: true,
          targetId: true,
          createdAt: true,
          metadata: true,
          admin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!log) {
        throw new NotFoundException({
          errorCode: 'AL404_ACTION_LOG_NOT_FOUND',
          message: 'Admin action log not found',
        });
      }

      return {
        logId: log.id,
        admin: {
          userId: log.admin.id,
          name: log.admin.name,
          email: log.admin.email,
        },
        actionType: log.actionType.toLowerCase(),
        action: log.action.toLowerCase(),
        targetId: log.targetId,
        createdAt: log.createdAt,
        details: log.metadata,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'AL500_ACTION_LOG_DETAIL_FETCH_FAILED',
        message: 'Failed to fetch admin action log detail',
      });
    }
  }
}
