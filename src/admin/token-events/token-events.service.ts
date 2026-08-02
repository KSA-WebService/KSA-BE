import { Injectable } from '@nestjs/common';
import { AdminAction, AdminActionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTokenEventDto } from './dto/create-token-event.dto';
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
}
