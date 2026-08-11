import {
  BadRequestException,
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
  AdminAction,
  AdminActionType,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

import {
  GetMyOrdersQueryDto,
  UserOrderStatus,
} from './dto/get-my-orders-query.dto';

import { GetAdminOrdersQueryDto } from './dto/get-admin-orders-query.dto';

import { isUUID } from 'class-validator';

import {
  AdminOrderStatusUpdate,
  UpdateOrderStatusDto,
} from './dto/update-order-status.dto';

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

  async getAdminOrders(query: GetAdminOrdersQueryDto) {
    const { page, limit, keyword, orderStatus, sort } = query;

    const normalizedKeyword = keyword?.trim();

    const where: Prisma.OrderWhereInput = {
      ...(orderStatus
        ? {
            status: this.toPrismaOrderStatus(orderStatus),
          }
        : {}),
    };

    if (normalizedKeyword) {
      const keywordConditions: Prisma.OrderWhereInput[] = [
        {
          product: {
            name: {
              contains: normalizedKeyword,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            name: {
              contains: normalizedKeyword,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            studentNumber: {
              contains: normalizedKeyword,
              mode: 'insensitive',
            },
          },
        },
        {
          user: {
            email: {
              contains: normalizedKeyword,
              mode: 'insensitive',
            },
          },
        },
      ];

      if (isUUID(normalizedKeyword)) {
        keywordConditions.unshift({
          id: normalizedKeyword,
        });
      }

      where.OR = keywordConditions;
    }

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
          user: {
            select: {
              id: true,
              name: true,
              studentNumber: true,
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
        customer: {
          userId: order.user.id,
          customerName: order.user.name,
          studentNumber: order.user.studentNumber,
          email: order.user.email,
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

  async updateOrderStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    adminId: string,
  ) {
    const cancellationReason = dto.cancellationReason?.trim();

    if (dto.orderStatus === 'canceled') {
      if (!cancellationReason) {
        throw new BadRequestException({
          errorCode: 'O400_CANCELLATION_REASON_REQUIRED',
          message: 'Cancellation reason is required',
        });
      }

      if (cancellationReason.length > 255) {
        throw new BadRequestException({
          errorCode: 'O400_CANCELLATION_REASON_TOO_LONG',
          message: 'Cancellation reason must not exceed 255 characters',
        });
      }
    } else if (dto.cancellationReason !== undefined) {
      throw new BadRequestException({
        errorCode: 'O400_CANCELLATION_REASON_NOT_ALLOWED',
        message: 'Cancellation reason is only allowed when canceling an order',
      });
    }

    const targetStatus = this.toPrismaAdminOrderStatus(dto.orderStatus);

    try {
      return await this.runSerializableTransaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: {
            id: orderId,
          },
          select: {
            id: true,
            userId: true,
            productId: true,
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
                stockQuantity: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
                studentNumber: true,
                email: true,
                tokenBalance: true,
              },
            },
          },
        });

        if (!order) {
          throw new NotFoundException({
            errorCode: 'O404_ORDER_NOT_FOUND',
            message: 'Order not found',
          });
        }

        /*
         * Same-state requests are treated as safe retries.
         */
        if (order.status === targetStatus) {
          if (targetStatus === OrderStatus.CANCELED) {
            if (order.cancellationReason !== cancellationReason) {
              throw new ConflictException({
                errorCode: 'O409_ORDER_CANCELLATION_CONFLICT',
                message:
                  'The order has already been canceled with a different reason',
              });
            }
          }

          return this.formatAdminOrderResponse(order);
        }

        if (!this.isValidOrderStatusTransition(order.status, targetStatus)) {
          throw new ConflictException({
            errorCode: 'O409_INVALID_ORDER_STATUS_TRANSITION',
            message: `Order cannot transition from ${order.status.toLowerCase()} to ${targetStatus.toLowerCase()}`,
          });
        }

        const now = new Date();

        /*
         * Cancellation reverses the original payment and stock reservation.
         */
        if (targetStatus === OrderStatus.CANCELED) {
          if (order.user.tokenBalance > MAX_DATABASE_INT - order.totalAmount) {
            throw new ConflictException({
              errorCode: 'O409_TOKEN_BALANCE_OVERFLOW',
              message: 'Token refund would exceed the supported token balance',
            });
          }

          if (order.product.stockQuantity > MAX_DATABASE_INT - order.quantity) {
            throw new ConflictException({
              errorCode: 'O409_PRODUCT_STOCK_OVERFLOW',
              message:
                'Stock restoration would exceed the supported stock quantity',
            });
          }

          const balanceBefore = order.user.tokenBalance;

          const updatedUser = await tx.user.update({
            where: {
              id: order.userId,
            },
            data: {
              tokenBalance: {
                increment: order.totalAmount,
              },
            },
            select: {
              tokenBalance: true,
            },
          });

          await tx.product.update({
            where: {
              id: order.productId,
            },
            data: {
              stockQuantity: {
                increment: order.quantity,
              },
            },
          });

          await tx.tokenLog.create({
            data: {
              transactionType: TokenTransactionType.ORDER_REFUND,
              adminId: null,
              userId: order.userId,
              tokenGrantId: null,
              orderId: order.id,
              balanceBefore,
              balanceAfter: updatedUser.tokenBalance,
              delta: order.totalAmount,
              reason: `Order refund - ${order.product.name}`,
            },
          });
        }

        const updatedOrder = await tx.order.update({
          where: {
            id: order.id,
          },
          data:
            targetStatus === OrderStatus.ACCEPTED
              ? {
                  status: OrderStatus.ACCEPTED,
                  acceptedAt: now,
                }
              : targetStatus === OrderStatus.DELIVERED
                ? {
                    status: OrderStatus.DELIVERED,
                    deliveredAt: now,
                  }
                : {
                    status: OrderStatus.CANCELED,
                    canceledAt: now,
                    cancellationReason,
                  },
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
            user: {
              select: {
                id: true,
                name: true,
                studentNumber: true,
                email: true,
              },
            },
          },
        });

        await tx.orderStatusLog.create({
          data: {
            changedBy: adminId,
            orderId: order.id,
            beforeStatus: order.status,
            afterStatus: targetStatus,
          },
        });

        const metadata: Prisma.InputJsonObject = {
          beforeStatus: order.status.toLowerCase(),
          afterStatus: targetStatus.toLowerCase(),
          ...(targetStatus === OrderStatus.CANCELED && cancellationReason
            ? {
                cancellationReason,
              }
            : {}),
        };

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.ORDER,
            action: AdminAction.UPDATE_ORDER_STATUS,
            targetId: order.id,
            metadata,
          },
        });

        return this.formatAdminOrderResponse(updatedOrder);
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      /*
       * A concurrent duplicate refund may reach the unique
       * (orderId, transactionType) constraint.
       *
       * Re-read the committed order and treat an identical cancellation
       * as a successful retry.
       */
      const isUniqueConstraintError =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002';

      if (
        isUniqueConstraintError &&
        dto.orderStatus === 'canceled' &&
        cancellationReason
      ) {
        const existingOrder = await this.findAdminOrderById(orderId);

        if (
          existingOrder?.status === OrderStatus.CANCELED &&
          existingOrder.cancellationReason === cancellationReason
        ) {
          return this.formatAdminOrderResponse(existingOrder);
        }
      }

      throw new InternalServerErrorException({
        errorCode: 'O500_ORDER_STATUS_UPDATE_FAILED',
        message: 'Failed to update order status',
      });
    }
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

  private isValidOrderStatusTransition(
    currentStatus: OrderStatus,
    targetStatus: OrderStatus,
  ): boolean {
    if (currentStatus === OrderStatus.ORDERED) {
      return (
        targetStatus === OrderStatus.ACCEPTED ||
        targetStatus === OrderStatus.CANCELED
      );
    }

    if (currentStatus === OrderStatus.ACCEPTED) {
      return (
        targetStatus === OrderStatus.DELIVERED ||
        targetStatus === OrderStatus.CANCELED
      );
    }

    return false;
  }

  private toPrismaAdminOrderStatus(
    orderStatus: AdminOrderStatusUpdate,
  ): OrderStatus {
    switch (orderStatus) {
      case 'accepted':
        return OrderStatus.ACCEPTED;

      case 'delivered':
        return OrderStatus.DELIVERED;

      case 'canceled':
        return OrderStatus.CANCELED;
    }
  }

  private findAdminOrderById(orderId: string) {
    return this.prisma.order.findUnique({
      where: {
        id: orderId,
      },
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
        user: {
          select: {
            id: true,
            name: true,
            studentNumber: true,
            email: true,
          },
        },
      },
    });
  }

  private formatAdminOrderResponse(order: {
    id: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    status: OrderStatus;
    createdAt: Date;
    acceptedAt: Date | null;
    deliveredAt: Date | null;
    canceledAt: Date | null;
    cancellationReason: string | null;
    product: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      name: string;
      studentNumber: string;
      email: string;
    };
  }) {
    return {
      orderId: order.id,
      product: {
        productId: order.product.id,
        productName: order.product.name,
      },
      customer: {
        userId: order.user.id,
        customerName: order.user.name,
        studentNumber: order.user.studentNumber,
        email: order.user.email,
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
    };
  }
}
