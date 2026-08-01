import { Injectable } from '@nestjs/common';
import { AdminAction, AdminActionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTokenEventDto } from './dto/create-token-event.dto';

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
}
