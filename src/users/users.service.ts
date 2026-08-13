import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetMyTokenLogsQueryDto } from './dto/get-my-token-logs-query.dto';
import {
  USER_ROLE_VALUE_MAP,
  USER_STATUS_VALUE_MAP,
} from '../common/constants/user-api-values';
import { TOKEN_TRANSACTION_TYPE_VALUE_MAP } from '../common/constants/token-api-values';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
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
      },
    });

    if (!user) {
      throw new ForbiddenException({
        errorCode: 'A403',
        message: 'Active user access is required',
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
    };
  }

  async findMyTokenLogs(userId: string, query: GetMyTokenLogsQueryDto) {
    const { page, limit } = query;

    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        tokenBalance: true,
      },
    });

    if (!user) {
      throw new ForbiddenException({
        errorCode: 'A403',
        message: 'Active user access is required',
      });
    }

    const [tokenLogs, totalCount] = await Promise.all([
      this.prisma.tokenLog.findMany({
        where: {
          userId,
        },
        skip: (page - 1) * limit,
        take: limit,
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
          transactionType: true,
          delta: true,
          reason: true,
          balanceBefore: true,
          balanceAfter: true,
          createdAt: true,
          tokenGrant: {
            select: {
              reason: true,
              tokenEvent: {
                select: {
                  id: true,
                  eventName: true,
                },
              },
            },
          },
          order: {
            select: {
              id: true,
              productId: true,
              quantity: true,
              unitPrice: true,
              totalAmount: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.tokenLog.count({
        where: {
          userId,
        },
      }),
    ]);

    return {
      currentTokenBalance: user.tokenBalance,
      items: tokenLogs.map((tokenLog) => ({
        tokenLogId: tokenLog.id,
        transactionType:
          TOKEN_TRANSACTION_TYPE_VALUE_MAP[tokenLog.transactionType],
        delta: tokenLog.delta,
        reason: tokenLog.tokenGrant?.reason ?? tokenLog.reason,
        balanceBefore: tokenLog.balanceBefore,
        balanceAfter: tokenLog.balanceAfter,
        createdAt: tokenLog.createdAt,
        tokenEvent: tokenLog.tokenGrant
          ? {
              tokenEventId: tokenLog.tokenGrant.tokenEvent.id,
              eventName: tokenLog.tokenGrant.tokenEvent.eventName,
            }
          : null,
        order: tokenLog.order
          ? {
              orderId: tokenLog.order.id,
              productId: tokenLog.order.productId,
              productName: tokenLog.order.product.name,
              quantity: tokenLog.order.quantity,
              unitPrice: tokenLog.order.unitPrice,
              totalAmount: tokenLog.order.totalAmount,
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }
}
