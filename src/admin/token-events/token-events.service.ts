import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTokenEventDto } from './dto/create-token-event.dto';
import {
  GetTokenEventDetailQueryDto,
  TokenGrantStatusFilter,
} from './dto/get-token-event-detail-query.dto';
import { GetTokenEventsQueryDto } from './dto/get-token-events-query.dto';

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
        page,
        limit,
        totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
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

      if (grantStatus === TokenGrantStatusFilter.GRANTED) {
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

      if (grantStatus === TokenGrantStatusFilter.NOT_GRANTED) {
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
            grantEligibility: isEligible ? 'ELIGIBLE' : 'ADJUSTMENT_ONLY',
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
        page,
        limit,
        totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      };
    });
  }
}
