import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  Prisma,
  PublicationStatus,
  TokenTransactionType,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

import {
  GetMyOrdersQueryDto,
  UserOrderStatus,
} from './dto/get-my-orders-query.dto';

const MAX_SERIALIZABLE_TRANSACTION_RETRIES = 3;
const MAX_DATABASE_INT = 2_147_483_647;

type ExistingOrder = {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  createdAt: Date;
  product: {
    name: string;
  };
  tokenLogs: Array<{
    balanceAfter: number;
  }>;
};

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async createOrder(
    dto: CreateOrderDto,
    userId: string,
    idempotencyKey: string,
  ) {
    try {
      /*
       * Fast path for retries after the original order has already committed.
       */
      const existingOrder =
        await this.findOrderByIdempotencyKey(idempotencyKey);

      if (existingOrder) {
        return this.resolveExistingOrder(existingOrder, dto, userId);
      }

      return await this.runSerializableTransaction(async (tx) => {
        /*
         * Check again inside the transaction.
         *
         * The outer check improves normal retry performance.
         * This inner check protects against a request that committed between
         * the outer lookup and the beginning of this transaction.
         */
        const existingOrderInTransaction = await tx.order.findUnique({
          where: {
            idempotencyKey,
          },
          select: {
            id: true,
            userId: true,
            productId: true,
            quantity: true,
            unitPrice: true,
            totalAmount: true,
            createdAt: true,
            product: {
              select: {
                name: true,
              },
            },
            tokenLogs: {
              where: {
                transactionType: TokenTransactionType.ORDER_PAYMENT,
              },
              take: 1,
              select: {
                balanceAfter: true,
              },
            },
          },
        });

        if (existingOrderInTransaction) {
          return this.resolveExistingOrder(
            existingOrderInTransaction,
            dto,
            userId,
          );
        }

        /*
         * Revalidate the user inside the transaction instead of relying only
         * on the authentication guard.
         */
        const user = await tx.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            role: true,
            status: true,
            deletedAt: true,
            tokenBalance: true,
          },
        });

        if (
          !user ||
          user.role !== UserRole.STUDENT ||
          user.status !== UserStatus.ACTIVE ||
          user.deletedAt !== null
        ) {
          throw new ForbiddenException({
            errorCode: 'O403_ORDER_NOT_ALLOWED',
            message: 'This account is not eligible to place orders',
          });
        }

        /*
         * Read the current product state and price from the database.
         * Client-supplied prices are never accepted.
         */
        const product = await tx.product.findUnique({
          where: {
            id: dto.productId,
          },
          select: {
            id: true,
            name: true,
            tokenPrice: true,
            stockQuantity: true,
            isOrderable: true,
            publicationStatus: true,
            deletedAt: true,
          },
        });

        if (!product || product.deletedAt !== null) {
          throw new NotFoundException({
            errorCode: 'O404_PRODUCT_NOT_FOUND',
            message: 'Product not found',
          });
        }

        if (
          product.publicationStatus !== PublicationStatus.PUBLISHED ||
          !product.isOrderable
        ) {
          throw new ConflictException({
            errorCode: 'O409_PRODUCT_UNAVAILABLE',
            message: 'Product is currently unavailable for ordering',
          });
        }

        if (product.stockQuantity < dto.quantity) {
          throw new ConflictException({
            errorCode: 'O409_INSUFFICIENT_STOCK',
            message: 'Insufficient product stock',
          });
        }

        const totalAmount = product.tokenPrice * dto.quantity;

        /*
         * User.tokenBalance and Order.totalAmount are database Int fields.
         * Any total above PostgreSQL/Prisma Int capacity cannot be paid by
         * a valid token balance anyway.
         */
        if (
          !Number.isSafeInteger(totalAmount) ||
          totalAmount > MAX_DATABASE_INT ||
          user.tokenBalance < totalAmount
        ) {
          throw new ConflictException({
            errorCode: 'O409_INSUFFICIENT_TOKENS',
            message: 'Insufficient token balance',
          });
        }

        /*
         * Atomically secure stock.
         *
         * The conditions are repeated in the UPDATE itself so two concurrent
         * buyers cannot both consume stock that is no longer available.
         */
        const stockUpdateResult = await tx.product.updateMany({
          where: {
            id: product.id,
            deletedAt: null,
            publicationStatus: PublicationStatus.PUBLISHED,
            isOrderable: true,
            stockQuantity: {
              gte: dto.quantity,
            },
          },
          data: {
            stockQuantity: {
              decrement: dto.quantity,
            },
          },
        });

        if (stockUpdateResult.count !== 1) {
          throw new ConflictException({
            errorCode: 'O409_PRODUCT_UNAVAILABLE',
            message: 'Product availability changed while ordering',
          });
        }

        /*
         * Atomically secure tokens.
         *
         * Eligibility and sufficient balance are part of the UPDATE
         * condition itself.
         */
        const tokenUpdateResult = await tx.user.updateMany({
          where: {
            id: user.id,
            role: UserRole.STUDENT,
            status: UserStatus.ACTIVE,
            deletedAt: null,
            tokenBalance: {
              gte: totalAmount,
            },
          },
          data: {
            tokenBalance: {
              decrement: totalAmount,
            },
          },
        });

        if (tokenUpdateResult.count !== 1) {
          throw new ConflictException({
            errorCode: 'O409_INSUFFICIENT_TOKENS',
            message: 'Insufficient token balance',
          });
        }

        /*
         * Read the actual balance after the atomic deduction.
         * This value becomes both the TokenLog balanceAfter and the response
         * remainingTokenBalance.
         */
        const updatedUser = await tx.user.findUnique({
          where: {
            id: user.id,
          },
          select: {
            tokenBalance: true,
          },
        });

        if (!updatedUser) {
          throw new ConflictException({
            errorCode: 'O409_ORDER_STATE_CONFLICT',
            message: 'User state changed while creating the order',
          });
        }

        const balanceAfter = updatedUser.tokenBalance;
        const balanceBefore = balanceAfter + totalAmount;

        const createdOrder = await tx.order.create({
          data: {
            userId: user.id,
            productId: product.id,
            idempotencyKey,
            quantity: dto.quantity,
            unitPrice: product.tokenPrice,
            totalAmount,
            status: OrderStatus.ORDERED,
          },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            totalAmount: true,
            createdAt: true,
          },
        });

        await tx.tokenLog.create({
          data: {
            transactionType: TokenTransactionType.ORDER_PAYMENT,
            adminId: null,
            userId: user.id,
            tokenGrantId: null,
            orderId: createdOrder.id,
            balanceBefore,
            balanceAfter,
            delta: -totalAmount,
            reason: `Order payment - ${product.name}`,
          },
        });

        return {
          orderId: createdOrder.id,
          product: {
            productId: product.id,
            productName: product.name,
          },
          quantity: createdOrder.quantity,
          unitPrice: createdOrder.unitPrice,
          totalAmount: createdOrder.totalAmount,
          orderStatus: 'ordered',
          remainingTokenBalance: balanceAfter,
          orderedAt: createdOrder.createdAt,
        };
      });
    } catch (error: unknown) {
      /*
       * Expected business errors should retain their original HTTP status and
       * error code.
       */
      if (error instanceof HttpException) {
        throw error;
      }

      /*
       * Two requests with the same idempotency key may reach the unique
       * constraint almost simultaneously.
       *
       * The losing transaction is rolled back automatically. We then look up
       * the committed order and treat it as an idempotent retry.
       */
      const isUniqueConstraintError =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';

      if (isUniqueConstraintError) {
        const existingOrder =
          await this.findOrderByIdempotencyKey(idempotencyKey);

        if (existingOrder) {
          return this.resolveExistingOrder(existingOrder, dto, userId);
        }
      }

      throw new InternalServerErrorException({
        errorCode: 'O500_ORDER_CREATE_FAILED',
        message: 'Failed to create order',
      });
    }
  }

  async getMyOrders(userId: string, query: GetMyOrdersQueryDto) {
    const { page, limit, orderStatus, sort } = query;

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(orderStatus
        ? {
            status: this.toPrismaOrderStatus(orderStatus),
          }
        : {}),
    };

    const sortDirection = sort === 'oldest' ? 'asc' : 'desc';

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          totalAmount: true,
          status: true,
          createdAt: true,
          acceptedAt: true,
          deliveredAt: true,
          canceledAt: true,
          cancellationReason: true,
          product: {
            select: {
              id: true,
              name: true,
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
      this.prisma.order.count({
        where,
      }),
    ]);

    return {
      items: orders.map((order) => ({
        orderId: order.id,
        product: {
          productId: order.product.id,
          productName: order.product.name,
        },
        quantity: order.quantity,
        unitPrice: order.unitPrice,
        totalAmount: order.totalAmount,
        orderStatus: order.status.toLowerCase(),
        orderedAt: order.createdAt,
        acceptedAt: order.acceptedAt,
        deliveredAt: order.deliveredAt,
        canceledAt: order.canceledAt,
        cancellationReason: order.cancellationReason,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async findOrderByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<ExistingOrder | null> {
    return this.prisma.order.findUnique({
      where: {
        idempotencyKey,
      },
      select: {
        id: true,
        userId: true,
        productId: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        createdAt: true,
        product: {
          select: {
            name: true,
          },
        },
        tokenLogs: {
          where: {
            transactionType: TokenTransactionType.ORDER_PAYMENT,
          },
          take: 1,
          select: {
            balanceAfter: true,
          },
        },
      },
    });
  }

  private resolveExistingOrder(
    order: ExistingOrder,
    dto: CreateOrderDto,
    userId: string,
  ) {
    /*
     * The same key may only represent the exact same purchase request.
     *
     * Checking userId also prevents a key collision from exposing another
     * user's order.
     */
    if (
      order.userId !== userId ||
      order.productId !== dto.productId ||
      order.quantity !== dto.quantity
    ) {
      throw new ConflictException({
        errorCode: 'O409_IDEMPOTENCY_KEY_REUSED',
        message:
          'Idempotency-Key has already been used for a different order request',
      });
    }

    const paymentLog = order.tokenLogs[0];

    if (!paymentLog) {
      throw new InternalServerErrorException({
        errorCode: 'O500_ORDER_CREATE_FAILED',
        message: 'Order payment history is missing',
      });
    }

    /*
     * Return the original purchase result.
     *
     * We deliberately use ORDER_PAYMENT.balanceAfter instead of the user's
     * current balance because the user's balance may have changed since the
     * original order was created.
     */
    return {
      orderId: order.id,
      product: {
        productId: order.productId,
        productName: order.product.name,
      },
      quantity: order.quantity,
      unitPrice: order.unitPrice,
      totalAmount: order.totalAmount,
      orderStatus: 'ordered',
      remainingTokenBalance: paymentLog.balanceAfter,
      orderedAt: order.createdAt,
    };
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
            errorCode: 'O409_ORDER_CONCURRENT_UPDATE',
            message:
              'Order could not be completed due to a concurrent update. Please try again',
          });
        }
      }
    }

    throw new ConflictException({
      errorCode: 'O409_ORDER_CONCURRENT_UPDATE',
      message:
        'Order could not be completed due to a concurrent update. Please try again',
    });
  }

  private toPrismaOrderStatus(orderStatus: UserOrderStatus): OrderStatus {
    switch (orderStatus) {
      case 'ordered':
        return OrderStatus.ORDERED;

      case 'accepted':
        return OrderStatus.ACCEPTED;

      case 'delivered':
        return OrderStatus.DELIVERED;

      case 'canceled':
        return OrderStatus.CANCELED;
    }
  }
}
