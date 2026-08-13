import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  Prisma,
  TokenTransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTokenEventDto } from './dto/create-token-event.dto';
import { GetTokenEventDetailQueryDto } from './dto/get-token-event-detail-query.dto';
import { GetTokenEventsQueryDto } from './dto/get-token-events-query.dto';
import { SaveTokenGrantsDto } from './dto/save-token-grants.dto';
import { UpdateTokenEventDto } from './dto/update-token-event.dto';
import {
  SaveTokenGrantStatusValue,
  TokenGrantEligibilityValue,
  TokenGrantStatusValue,
} from '../../common/constants/token-api-values';

type SaveTokenGrantStatus = 'CREATED' | 'UPDATED' | 'UNCHANGED';

const MAX_SERIALIZABLE_TRANSACTION_RETRIES = 3;

@Injectable()
export class TokenEventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateTokenEventDto, adminId: string) {
    const eventName = dto.eventName.trim();

    const tokenEvent = await this.prisma.$transaction(async (tx) => {
      const createdTokenEvent = await tx.tokenEvent.create({
        data: {
          createdBy: adminId,
          eventName,
        },
        select: {
          id: true,
          eventName: true,
          createdAt: true,
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId,
          actionType: AdminActionType.TOKEN,
          action: AdminAction.CREATE_TOKEN_EVENT,
          targetId: createdTokenEvent.id,
          metadata: {
            eventName: createdTokenEvent.eventName,
          },
        },
      });

      return createdTokenEvent;
    });

    return {
      tokenEventId: tokenEvent.id,
      eventName: tokenEvent.eventName,
      createdBy: {
        userId: tokenEvent.creator.id,
        name: tokenEvent.creator.name,
      },
      createdAt: tokenEvent.createdAt,
    };
  }

  async findAll(query: GetTokenEventsQueryDto) {
    const { page, limit, keyword } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TokenEventWhereInput = {
      deletedAt: null,
      ...(keyword
        ? {
            eventName: {
              contains: keyword,
              mode: Prisma.QueryMode.insensitive,
            },
          }
        : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      const [tokenEvents, totalCount] = await Promise.all([
        tx.tokenEvent.findMany({
          where,
          skip,
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
            eventName: true,
            createdAt: true,
            creator: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        tx.tokenEvent.count({
          where,
        }),
      ]);

      const tokenEventIds = tokenEvents.map((tokenEvent) => tokenEvent.id);

      let lastGrantUpdates: Array<{
        tokenEventId: string;
        _max: {
          updatedAt: Date | null;
        };
      }> = [];

      let positiveGrantCounts: Array<{
        tokenEventId: string;
        _count: {
          _all: number;
        };
      }> = [];

      if (tokenEventIds.length > 0) {
        [lastGrantUpdates, positiveGrantCounts] = await Promise.all([
          tx.tokenGrant.groupBy({
            by: ['tokenEventId'],
            where: {
              tokenEventId: {
                in: tokenEventIds,
              },
            },
            _max: {
              updatedAt: true,
            },
          }),
          tx.tokenGrant.groupBy({
            by: ['tokenEventId'],
            where: {
              tokenEventId: {
                in: tokenEventIds,
              },
              grantedAmount: {
                gt: 0,
              },
            },
            _count: {
              _all: true,
            },
          }),
        ]);
      }

      const lastGrantUpdatedAtByEventId = new Map(
        lastGrantUpdates.map((grant) => [
          grant.tokenEventId,
          grant._max.updatedAt,
        ]),
      );

      const grantedMemberCountByEventId = new Map(
        positiveGrantCounts.map((grant) => [
          grant.tokenEventId,
          grant._count._all,
        ]),
      );

      return {
        items: tokenEvents.map((tokenEvent) => ({
          tokenEventId: tokenEvent.id,
          eventName: tokenEvent.eventName,
          createdBy: {
            userId: tokenEvent.creator.id,
            name: tokenEvent.creator.name,
          },
          createdAt: tokenEvent.createdAt,
          lastGrantUpdatedAt:
            lastGrantUpdatedAtByEventId.get(tokenEvent.id) ?? null,
          grantedMemberCount:
            grantedMemberCountByEventId.get(tokenEvent.id) ?? 0,
        })),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
        },
      };
    });
  }

  async findOne(tokenEventId: string, query: GetTokenEventDetailQueryDto) {
    const { page, limit, keyword, grantStatus } = query;

    const skip = (page - 1) * limit;

    return this.prisma.$transaction(async (tx) => {
      const tokenEvent = await tx.tokenEvent.findFirst({
        where: {
          id: tokenEventId,
          deletedAt: null,
        },
        select: {
          id: true,
          eventName: true,
          createdAt: true,
          updatedAt: true,
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!tokenEvent) {
        throw new NotFoundException({
          errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
          message: 'Token event not found',
        });
      }

      const memberConditions: Prisma.UserWhereInput[] = [
        {
          OR: [
            {
              role: UserRole.STUDENT,
              status: UserStatus.ACTIVE,
              deletedAt: null,
            },
            {
              tokenGrantsAsUser: {
                some: {
                  tokenEventId,
                },
              },
            },
          ],
        },
      ];

      if (keyword) {
        memberConditions.push({
          OR: [
            {
              name: {
                contains: keyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              email: {
                contains: keyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              studentNumber: {
                contains: keyword,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ],
        });
      }

      if (grantStatus === TokenGrantStatusValue.GRANTED) {
        memberConditions.push({
          tokenGrantsAsUser: {
            some: {
              tokenEventId,
              grantedAmount: {
                gt: 0,
              },
            },
          },
        });
      }

      if (grantStatus === TokenGrantStatusValue.NOT_GRANTED) {
        memberConditions.push({
          OR: [
            {
              tokenGrantsAsUser: {
                none: {
                  tokenEventId,
                },
              },
            },
            {
              tokenGrantsAsUser: {
                some: {
                  tokenEventId,
                  grantedAmount: 0,
                },
              },
            },
          ],
        });
      }

      const memberWhere: Prisma.UserWhereInput = {
        AND: memberConditions,
      };

      const [members, totalCount, grantUpdateAggregate, grantedMemberCount] =
        await Promise.all([
          tx.user.findMany({
            where: memberWhere,
            skip,
            take: limit,
            orderBy: [
              {
                name: 'asc',
              },
              {
                studentNumber: 'asc',
              },
              {
                id: 'asc',
              },
            ],
            select: {
              id: true,
              name: true,
              studentNumber: true,
              email: true,
              role: true,
              status: true,
              deletedAt: true,
              tokenBalance: true,
              tokenGrantsAsUser: {
                where: {
                  tokenEventId,
                },
                take: 1,
                select: {
                  id: true,
                  grantedAmount: true,
                  reason: true,
                  createdAt: true,
                  updatedAt: true,
                  admin: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          }),
          tx.user.count({
            where: memberWhere,
          }),
          tx.tokenGrant.aggregate({
            where: {
              tokenEventId,
            },
            _max: {
              updatedAt: true,
            },
          }),
          tx.tokenGrant.count({
            where: {
              tokenEventId,
              grantedAmount: {
                gt: 0,
              },
            },
          }),
        ]);

      return {
        tokenEventId: tokenEvent.id,
        eventName: tokenEvent.eventName,
        createdBy: {
          userId: tokenEvent.creator.id,
          name: tokenEvent.creator.name,
        },
        createdAt: tokenEvent.createdAt,
        eventUpdatedAt: tokenEvent.updatedAt,
        lastGrantUpdatedAt: grantUpdateAggregate._max.updatedAt ?? null,
        grantedMemberCount,
        items: members.map((member) => {
          const tokenGrant = member.tokenGrantsAsUser[0] ?? null;

          const isEligible =
            member.role === UserRole.STUDENT &&
            member.status === UserStatus.ACTIVE &&
            member.deletedAt === null;

          return {
            userId: member.id,
            name: member.name,
            studentNumber: member.studentNumber,
            email: member.email,
            grantEligibility: isEligible
              ? TokenGrantEligibilityValue.ELIGIBLE
              : TokenGrantEligibilityValue.ADJUSTMENT_ONLY,
            currentTokenBalance: member.tokenBalance,
            tokenGrantId: tokenGrant?.id ?? null,
            grantedAmount: tokenGrant?.grantedAmount ?? null,
            reason: tokenGrant?.reason ?? null,
            grantedBy: tokenGrant
              ? {
                  userId: tokenGrant.admin.id,
                  name: tokenGrant.admin.name,
                }
              : null,
            grantedAt: tokenGrant?.createdAt ?? null,
            grantUpdatedAt: tokenGrant?.updatedAt ?? null,
          };
        }),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
        },
      };
    });
  }

  async updateTokenEvent(
    tokenEventId: string,
    dto: UpdateTokenEventDto,
    adminId: string,
  ) {
    return this.runSerializableTransaction(async (tx) => {
      const tokenEvent = await tx.tokenEvent.findFirst({
        where: {
          id: tokenEventId,
          deletedAt: null,
        },
        select: {
          id: true,
          eventName: true,
          updatedAt: true,
        },
      });

      if (!tokenEvent) {
        throw new NotFoundException({
          errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
          message: 'Token event not found',
        });
      }

      if (tokenEvent.eventName === dto.eventName) {
        return {
          tokenEventId: tokenEvent.id,
          eventName: tokenEvent.eventName,
          updatedAt: tokenEvent.updatedAt,
        };
      }

      const updatedAt = new Date();

      const updateResult = await tx.tokenEvent.updateMany({
        where: {
          id: tokenEventId,
          deletedAt: null,
        },
        data: {
          eventName: dto.eventName,
          updatedAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new NotFoundException({
          errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
          message: 'Token event not found',
        });
      }

      await tx.adminActionLog.create({
        data: {
          adminId,
          actionType: AdminActionType.TOKEN,
          action: AdminAction.UPDATE_TOKEN_EVENT,
          targetId: tokenEventId,
          metadata: {
            previousEventName: tokenEvent.eventName,
            updatedEventName: dto.eventName,
          },
        },
      });

      return {
        tokenEventId,
        eventName: dto.eventName,
        updatedAt,
      };
    });
  }

  async saveGrants(
    tokenEventId: string,
    adminId: string,
    dto: SaveTokenGrantsDto,
  ) {
    return this.runSerializableTransaction(async (tx) => {
      const tokenEvent = await tx.tokenEvent.findFirst({
        where: {
          id: tokenEventId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!tokenEvent) {
        throw new NotFoundException({
          errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
          message: 'Token event not found',
        });
      }

      const userIds = dto.grants.map((grant) => grant.userId);

      const [users, existingGrants] = await Promise.all([
        tx.user.findMany({
          where: {
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            name: true,
            studentNumber: true,
            role: true,
            status: true,
            deletedAt: true,
            tokenBalance: true,
          },
        }),
        tx.tokenGrant.findMany({
          where: {
            tokenEventId,
            userId: {
              in: userIds,
            },
          },
          select: {
            id: true,
            userId: true,
            grantedAmount: true,
            reason: true,
          },
        }),
      ]);

      const userMap = new Map(users.map((user) => [user.id, user]));

      const existingGrantMap = new Map(
        existingGrants.map((grant) => [grant.userId, grant]),
      );

      const missingUserId = userIds.find((userId) => !userMap.has(userId));

      if (missingUserId) {
        throw new NotFoundException({
          errorCode: 'U404_USER_NOT_FOUND',
          message: 'Target user not found',
        });
      }

      /*
       * 모든 회원에 대한 정책 검증을 먼저 완료한다.
       * 한 명이라도 실패하면 쓰기 작업을 시작하지 않는다.
       */
      const plans = dto.grants.map((requestedGrant) => {
        const user = userMap.get(requestedGrant.userId);

        if (!user) {
          throw new NotFoundException({
            errorCode: 'U404_USER_NOT_FOUND',
            message: 'Target user not found',
          });
        }

        const existingGrant = existingGrantMap.get(requestedGrant.userId);

        const previousGrantedAmount = existingGrant?.grantedAmount ?? 0;

        const deltaAmount =
          requestedGrant.grantedAmount - previousGrantedAmount;

        const reasonChanged =
          existingGrant !== undefined &&
          existingGrant.reason !== requestedGrant.reason;

        const isEligibleForIncrease =
          user.role === UserRole.STUDENT &&
          user.status === UserStatus.ACTIVE &&
          user.deletedAt === null;

        if (deltaAmount > 0 && !isEligibleForIncrease) {
          throw new ConflictException({
            errorCode: 'T409_TOKEN_GRANT_TARGET_INELIGIBLE',
            message:
              'Target user is not eligible for a new or increased token grant',
          });
        }

        const balanceAfter = user.tokenBalance + deltaAmount;

        if (deltaAmount < 0 && balanceAfter < 0) {
          throw new ConflictException({
            errorCode: 'T409_INSUFFICIENT_TOKEN_BALANCE',
            message:
              'The token grant cannot be reduced because the user has insufficient balance',
          });
        }

        let status: SaveTokenGrantStatus;

        if (!existingGrant) {
          status = requestedGrant.grantedAmount > 0 ? 'CREATED' : 'UNCHANGED';
        } else if (deltaAmount !== 0 || reasonChanged) {
          status = 'UPDATED';
        } else {
          status = 'UNCHANGED';
        }

        return {
          requestedGrant,
          user,
          existingGrant,
          previousGrantedAmount,
          deltaAmount,
          balanceBefore: user.tokenBalance,
          balanceAfter,
          reasonChanged,
          status,
        };
      });

      const items: Array<{
        status: SaveTokenGrantStatusValue;
        tokenGrantId: string | null;
        tokenLogId: string | null;
        userId: string;
        name: string;
        studentNumber: string;
        previousGrantedAmount: number;
        grantedAmount: number;
        deltaAmount: number;
        reason: string;
        balanceBefore: number;
        balanceAfter: number;
      }> = [];

      for (const plan of plans) {
        let tokenGrantId = plan.existingGrant?.id ?? null;

        let tokenLogId: string | null = null;

        if (plan.status === 'CREATED') {
          const createdGrant = await tx.tokenGrant.create({
            data: {
              tokenEventId,
              userId: plan.user.id,
              grantedBy: adminId,
              grantedAmount: plan.requestedGrant.grantedAmount,
              reason: plan.requestedGrant.reason,
            },
            select: {
              id: true,
            },
          });

          tokenGrantId = createdGrant.id;
        } else if (plan.status === 'UPDATED') {
          if (!plan.existingGrant) {
            throw new ConflictException({
              errorCode: 'T409_TOKEN_GRANT_STATE_CONFLICT',
              message: 'Token grant state changed during processing',
            });
          }

          await tx.tokenGrant.update({
            where: {
              id: plan.existingGrant.id,
            },
            data: {
              grantedAmount: plan.requestedGrant.grantedAmount,
              reason: plan.requestedGrant.reason,
            },
          });
        }

        if (plan.deltaAmount !== 0) {
          await tx.user.update({
            where: {
              id: plan.user.id,
            },
            data: {
              tokenBalance: {
                increment: plan.deltaAmount,
              },
            },
          });

          if (!tokenGrantId) {
            throw new ConflictException({
              errorCode: 'T409_TOKEN_GRANT_STATE_CONFLICT',
              message: 'Token grant state changed during processing',
            });
          }

          const createdTokenLog = await tx.tokenLog.create({
            data: {
              transactionType:
                plan.status === 'CREATED'
                  ? TokenTransactionType.EVENT_GRANT
                  : TokenTransactionType.EVENT_ADJUSTMENT,
              adminId,
              userId: plan.user.id,
              tokenGrantId,
              balanceBefore: plan.balanceBefore,
              balanceAfter: plan.balanceAfter,
              delta: plan.deltaAmount,
              reason: plan.requestedGrant.reason,
            },
            select: {
              id: true,
            },
          });

          tokenLogId = createdTokenLog.id;
        }

        items.push({
          status:
            plan.status === 'CREATED'
              ? SaveTokenGrantStatusValue.CREATED
              : plan.status === 'UPDATED'
                ? SaveTokenGrantStatusValue.UPDATED
                : SaveTokenGrantStatusValue.UNCHANGED,
          tokenGrantId,
          tokenLogId,
          userId: plan.user.id,
          name: plan.user.name,
          studentNumber: plan.user.studentNumber,
          previousGrantedAmount: plan.previousGrantedAmount,
          grantedAmount: plan.requestedGrant.grantedAmount,
          deltaAmount: plan.deltaAmount,
          reason: plan.requestedGrant.reason,
          balanceBefore: plan.balanceBefore,
          balanceAfter: plan.balanceAfter,
        });
      }

      const savedCount = items.filter(
        (item) => item.status !== SaveTokenGrantStatusValue.UNCHANGED,
      ).length;

      const unchangedCount = items.length - savedCount;

      if (savedCount > 0) {
        const metadata = {
          tokenEventId,
          processedCount: items.length,
          savedCount,
          unchangedCount,
          changes: plans
            .filter((plan) => plan.status !== 'UNCHANGED')
            .map((plan) => ({
              userId: plan.user.id,
              status: plan.status,
              previousGrantedAmount: plan.previousGrantedAmount,
              grantedAmount: plan.requestedGrant.grantedAmount,
              deltaAmount: plan.deltaAmount,
              reasonChanged: plan.reasonChanged,
            })),
        } as Prisma.InputJsonValue;

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.TOKEN,
            targetId: tokenEventId,
            action: AdminAction.SAVE_TOKEN_GRANTS,
            metadata,
          },
        });
      }

      return {
        tokenEventId,
        processedCount: items.length,
        savedCount,
        unchangedCount,
        items,
      };
    });
  }

  async deleteTokenEvent(tokenEventId: string, adminId: string) {
    return this.runSerializableTransaction(async (tx) => {
      const tokenEvent = await tx.tokenEvent.findFirst({
        where: {
          id: tokenEventId,
          deletedAt: null,
        },
        select: {
          id: true,
          eventName: true,
        },
      });

      if (!tokenEvent) {
        throw new NotFoundException({
          errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
          message: 'Token event not found',
        });
      }

      const grantedMemberCount = await tx.tokenGrant.count({
        where: {
          tokenEventId,
          grantedAmount: {
            gt: 0,
          },
        },
      });

      const deletedAt = new Date();

      const updateResult = await tx.tokenEvent.updateMany({
        where: {
          id: tokenEventId,
          deletedAt: null,
        },
        data: {
          deletedAt,
        },
      });

      if (updateResult.count !== 1) {
        throw new NotFoundException({
          errorCode: 'T404_TOKEN_EVENT_NOT_FOUND',
          message: 'Token event not found',
        });
      }

      const metadata: Prisma.InputJsonObject = {
        eventName: tokenEvent.eventName,
        grantedMemberCount,
        deletedAt: deletedAt.toISOString(),
      };

      await tx.adminActionLog.create({
        data: {
          adminId,
          actionType: AdminActionType.TOKEN,
          action: AdminAction.DELETE_TOKEN_EVENT,
          targetId: tokenEventId,
          metadata,
        },
      });

      return {
        deletedTokenEventId: tokenEvent.id,
        deletedAt,
      };
    });
  }

  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_RETRIES;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const isTransactionConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isTransactionConflict) {
          throw error;
        }

        if (attempt === MAX_SERIALIZABLE_TRANSACTION_RETRIES) {
          throw new ConflictException({
            errorCode: 'T409_TOKEN_GRANT_SAVE_CONFLICT',
            message:
              'Token grants could not be saved due to a concurrent update',
          });
        }
      }
    }

    throw new ConflictException({
      errorCode: 'T409_TOKEN_GRANT_SAVE_CONFLICT',
      message: 'Token grants could not be saved due to a concurrent update',
    });
  }
}
