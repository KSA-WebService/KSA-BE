import {
  BadRequestException,
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
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ResetTokenBalancesDto } from './dto/reset-token-balances.dto';

const RESET_CONFIRMATION = 'RESET_ALL_STUDENT_TOKEN_BALANCES';

const MAX_SERIALIZABLE_TRANSACTION_RETRIES = 3;

@Injectable()
export class TokenBalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getResetPreview() {
    const preview = await this.prisma.user.aggregate({
      where: {
        role: UserRole.STUDENT,
        tokenBalance: {
          gt: 0,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        tokenBalance: true,
      },
    });

    return {
      affectedMemberCount: preview._count._all,
      totalResetAmount: preview._sum.tokenBalance ?? 0,
      previewedAt: new Date(),
    };
  }

  async resetTokenBalances(body: ResetTokenBalancesDto, adminId: string) {
    if (body.confirmation !== RESET_CONFIRMATION) {
      throw new BadRequestException({
        errorCode: 'T400_INVALID_RESET_CONFIRMATION',
        message: 'Reset confirmation phrase does not match',
      });
    }

    const reason = body.reason.trim();

    return this.runSerializableTransaction(async (tx) => {
      const admin = await tx.user.findUnique({
        where: {
          id: adminId,
        },
        select: {
          id: true,
          name: true,
        },
      });

      if (!admin) {
        throw new NotFoundException({
          errorCode: 'U404_ADMIN_NOT_FOUND',
          message: 'Administrator not found',
        });
      }

      const resetTargets = await tx.user.findMany({
        where: {
          role: UserRole.STUDENT,
          tokenBalance: {
            gt: 0,
          },
        },
        select: {
          id: true,
          tokenBalance: true,
        },
        orderBy: {
          id: 'asc',
        },
      });

      if (resetTargets.length === 0) {
        return {
          affectedMemberCount: 0,
          totalResetAmount: 0,
          reason,
          performedBy: {
            userId: admin.id,
            name: admin.name,
          },
          performedAt: new Date(),
        };
      }

      const affectedMemberCount = resetTargets.length;

      const totalResetAmount = resetTargets.reduce(
        (total, user) => total + user.tokenBalance,
        0,
      );

      await tx.tokenLog.createMany({
        data: resetTargets.map((user) => ({
          transactionType: TokenTransactionType.RESET,
          adminId,
          userId: user.id,
          balanceBefore: user.tokenBalance,
          balanceAfter: 0,
          delta: -user.tokenBalance,
          reason,
        })),
      });

      const updateResult = await tx.user.updateMany({
        where: {
          id: {
            in: resetTargets.map((user) => user.id),
          },
          role: UserRole.STUDENT,
          tokenBalance: {
            gt: 0,
          },
        },
        data: {
          tokenBalance: 0,
        },
      });

      if (updateResult.count !== affectedMemberCount) {
        throw new ConflictException({
          errorCode: 'T409_TOKEN_BALANCE_RESET_CONFLICT',
          message: 'Token balances changed while the reset was being processed',
        });
      }

      const metadata: Prisma.InputJsonObject = {
        affectedMemberCount,
        totalResetAmount,
        reason,
      };

      const adminAction = await tx.adminActionLog.create({
        data: {
          adminId,
          actionType: AdminActionType.TOKEN,
          action: AdminAction.RESET_TOKEN_BALANCES,
          targetId: null,
          metadata,
        },
        select: {
          createdAt: true,
        },
      });

      return {
        affectedMemberCount,
        totalResetAmount,
        reason,
        performedBy: {
          userId: admin.id,
          name: admin.name,
        },
        performedAt: adminAction.createdAt,
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
            errorCode: 'T409_TOKEN_BALANCE_RESET_CONFLICT',
            message:
              'Token balances could not be reset due to a concurrent update',
          });
        }
      }
    }

    throw new ConflictException({
      errorCode: 'T409_TOKEN_BALANCE_RESET_CONFLICT',
      message: 'Token balances could not be reset due to a concurrent update',
    });
  }
}
