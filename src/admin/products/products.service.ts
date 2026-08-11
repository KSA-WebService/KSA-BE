import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  FilePurpose,
  FileStatus,
  Prisma,
  ProductType,
  PublicationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductDto,
  CreateProductPublicationStatusValue,
  CreateProductTypeValue,
} from './dto/create-product.dto';

import {
  AdminProductAvailabilityStatusFilter,
  AdminProductPublicationStatusFilter,
  AdminProductSort,
  AdminProductTypeFilter,
  ListProductsQueryDto,
} from './dto/list-products-query.dto';

import {
  UpdateProductDto,
  UpdateProductPublicationStatusValue,
} from './dto/update-product.dto';

import {
  ListPublicProductsQueryDto,
  PublicProductSort,
  PublicProductTypeFilter,
} from './dto/list-public-products-query.dto';

const PRODUCT_TYPE_MAP: Record<CreateProductTypeValue, ProductType> = {
  [CreateProductTypeValue.TICKET]: ProductType.TICKET,
  [CreateProductTypeValue.MERCHANDISE]: ProductType.MERCHANDISE,
};

const PUBLICATION_STATUS_MAP: Record<
  CreateProductPublicationStatusValue,
  PublicationStatus
> = {
  [CreateProductPublicationStatusValue.DRAFT]: PublicationStatus.DRAFT,
  [CreateProductPublicationStatusValue.PUBLISHED]: PublicationStatus.PUBLISHED,
};

const PRODUCT_TYPE_VALUE_MAP: Record<ProductType, CreateProductTypeValue> = {
  [ProductType.TICKET]: CreateProductTypeValue.TICKET,
  [ProductType.MERCHANDISE]: CreateProductTypeValue.MERCHANDISE,
};

const PUBLICATION_STATUS_VALUE_MAP: Record<
  PublicationStatus,
  'draft' | 'published' | 'hidden'
> = {
  [PublicationStatus.DRAFT]: 'draft',
  [PublicationStatus.PUBLISHED]: 'published',
  [PublicationStatus.HIDDEN]: 'hidden',
};

const PRODUCT_TYPE_FILTER_MAP: Record<AdminProductTypeFilter, ProductType> = {
  [AdminProductTypeFilter.TICKET]: ProductType.TICKET,
  [AdminProductTypeFilter.MERCHANDISE]: ProductType.MERCHANDISE,
};

const PUBLICATION_STATUS_FILTER_MAP: Record<
  AdminProductPublicationStatusFilter,
  PublicationStatus
> = {
  [AdminProductPublicationStatusFilter.DRAFT]: PublicationStatus.DRAFT,
  [AdminProductPublicationStatusFilter.PUBLISHED]: PublicationStatus.PUBLISHED,
  [AdminProductPublicationStatusFilter.HIDDEN]: PublicationStatus.HIDDEN,
};

const UPDATE_PUBLICATION_STATUS_MAP: Record<
  UpdateProductPublicationStatusValue,
  PublicationStatus
> = {
  [UpdateProductPublicationStatusValue.DRAFT]: PublicationStatus.DRAFT,
  [UpdateProductPublicationStatusValue.PUBLISHED]: PublicationStatus.PUBLISHED,
  [UpdateProductPublicationStatusValue.HIDDEN]: PublicationStatus.HIDDEN,
};

const PUBLIC_PRODUCT_TYPE_FILTER_MAP: Record<
  PublicProductTypeFilter,
  ProductType
> = {
  [PublicProductTypeFilter.TICKET]: ProductType.TICKET,
  [PublicProductTypeFilter.MERCHANDISE]: ProductType.MERCHANDISE,
};

const MAX_SERIALIZABLE_TRANSACTION_RETRIES = 3;
@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto, adminId: string) {
    const publicationStatus = PUBLICATION_STATUS_MAP[dto.publicationStatus];

    const isPublished = publicationStatus === PublicationStatus.PUBLISHED;

    if (isPublished && !dto.description) {
      throw new BadRequestException({
        errorCode: 'P400_PRODUCT_DESCRIPTION_REQUIRED',
        message: 'Description is required for a published product',
      });
    }

    if (isPublished && !dto.imageFileId) {
      throw new BadRequestException({
        errorCode: 'P400_PRODUCT_IMAGE_REQUIRED',
        message: 'Image is required for a published product',
      });
    }

    const isOrderable = dto.isOrderable ?? true;

    const publishedAt = isPublished ? new Date() : null;

    try {
      return await this.runSerializableTransaction(async (tx) => {
        if (dto.imageFileId) {
          const imageFile = await tx.file.findFirst({
            where: {
              id: dto.imageFileId,
              deletedAt: null,
            },
            select: {
              id: true,
              status: true,
              purpose: true,
            },
          });

          if (!imageFile) {
            throw new NotFoundException({
              errorCode: 'F404_FILE_NOT_FOUND',
              message: 'File not found',
            });
          }

          if (
            imageFile.status !== FileStatus.COMPLETED ||
            imageFile.purpose !== FilePurpose.PRODUCT_IMAGE
          ) {
            throw new BadRequestException({
              errorCode: 'P400_PRODUCT_IMAGE_INVALID',
              message: 'The file cannot be used as a product image',
            });
          }
        }

        const product = await tx.product.create({
          data: {
            name: dto.productName,
            productType: PRODUCT_TYPE_MAP[dto.productType],
            tokenPrice: dto.tokenPrice,
            stockQuantity: dto.stockQuantity,
            isOrderable,
            description: dto.description ?? null,
            imageFileId: dto.imageFileId ?? null,
            publicationStatus,
            publishedAt,
          },
          select: {
            id: true,
            name: true,
            productType: true,
            tokenPrice: true,
            stockQuantity: true,
            isOrderable: true,
            description: true,
            publicationStatus: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            imageFile: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
          },
        });

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.PRODUCT,
            action: AdminAction.CREATE_PRODUCT,
            targetId: product.id,
            metadata: {
              productName: product.name,
              productType: PRODUCT_TYPE_VALUE_MAP[product.productType],
              publicationStatus:
                PUBLICATION_STATUS_VALUE_MAP[product.publicationStatus],
            },
          },
        });

        return {
          productId: product.id,
          productName: product.name,
          productType: PRODUCT_TYPE_VALUE_MAP[product.productType],
          tokenPrice: product.tokenPrice,
          stockQuantity: product.stockQuantity,
          isOrderable: product.isOrderable,
          availabilityStatus:
            product.isOrderable && product.stockQuantity > 0
              ? 'available'
              : 'unavailable',
          publicationStatus:
            PUBLICATION_STATUS_VALUE_MAP[product.publicationStatus],
          description: product.description,
          image: product.imageFile
            ? {
                fileId: product.imageFile.id,
                fileUrl: product.imageFile.fileUrl,
              }
            : null,
          publishedAt: product.publishedAt,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'P500_PRODUCT_CREATE_FAILED',
        message: 'Failed to create the product',
      });
    }
  }

  async getProductList(query: ListProductsQueryDto) {
    const {
      page,
      limit,
      keyword,
      productType,
      publicationStatus,
      availabilityStatus,
      sort,
    } = query;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
    };

    if (keyword) {
      where.name = {
        contains: keyword,
        mode: 'insensitive',
      };
    }

    if (productType) {
      where.productType = PRODUCT_TYPE_FILTER_MAP[productType];
    }

    if (publicationStatus) {
      where.publicationStatus =
        PUBLICATION_STATUS_FILTER_MAP[publicationStatus];
    }

    if (availabilityStatus === AdminProductAvailabilityStatusFilter.AVAILABLE) {
      where.isOrderable = true;
      where.stockQuantity = {
        gt: 0,
      };
    }

    if (
      availabilityStatus === AdminProductAvailabilityStatusFilter.UNAVAILABLE
    ) {
      where.OR = [
        {
          isOrderable: false,
        },
        {
          stockQuantity: {
            lte: 0,
          },
        },
      ];
    }

    const sortDirection = sort === AdminProductSort.OLDEST ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    try {
      const [products, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            productType: true,
            tokenPrice: true,
            stockQuantity: true,
            isOrderable: true,
            publicationStatus: true,
            updatedAt: true,
            imageFile: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
          },
          orderBy: [
            {
              updatedAt: sortDirection,
            },
            {
              id: sortDirection,
            },
          ],
          skip,
          take: limit,
        }),
        this.prisma.product.count({
          where,
        }),
      ]);

      return {
        items: products.map((product) => ({
          productId: product.id,
          productName: product.name,
          productType: PRODUCT_TYPE_VALUE_MAP[product.productType],
          tokenPrice: product.tokenPrice,
          stockQuantity: product.stockQuantity,
          isOrderable: product.isOrderable,
          availabilityStatus:
            product.isOrderable && product.stockQuantity > 0
              ? 'available'
              : 'unavailable',
          publicationStatus:
            PUBLICATION_STATUS_VALUE_MAP[product.publicationStatus],
          image: product.imageFile
            ? {
                fileId: product.imageFile.id,
                fileUrl: product.imageFile.fileUrl,
              }
            : null,
          updatedAt: product.updatedAt,
        })),
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch {
      throw new InternalServerErrorException({
        errorCode: 'P500_PRODUCT_LIST_FETCH_FAILED',
        message: 'Failed to fetch the product list',
      });
    }
  }

  async getPublicProductList(query: ListPublicProductsQueryDto) {
    const { page, limit, productType, sort } = query;

    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      publicationStatus: PublicationStatus.PUBLISHED,
    };

    if (productType) {
      where.productType = PUBLIC_PRODUCT_TYPE_FILTER_MAP[productType];
    }

    const sortDirection = sort === PublicProductSort.OLDEST ? 'asc' : 'desc';

    const skip = (page - 1) * limit;

    try {
      const [products, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            productType: true,
            description: true,
            tokenPrice: true,
            stockQuantity: true,
            isOrderable: true,
            publishedAt: true,
            imageFile: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
          },
          orderBy: [
            {
              publishedAt: sortDirection,
            },
            {
              id: sortDirection,
            },
          ],
          skip,
          take: limit,
        }),
        this.prisma.product.count({
          where,
        }),
      ]);

      return {
        items: products.map((product) => ({
          productId: product.id,
          productName: product.name,
          productType: PRODUCT_TYPE_VALUE_MAP[product.productType],
          description: product.description,
          tokenPrice: product.tokenPrice,
          image: product.imageFile
            ? {
                fileId: product.imageFile.id,
                fileUrl: product.imageFile.fileUrl,
              }
            : null,
          availabilityStatus:
            product.isOrderable && product.stockQuantity > 0
              ? 'available'
              : 'unavailable',
          publishedAt: product.publishedAt,
        })),
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch {
      throw new InternalServerErrorException({
        errorCode: 'P500_PUBLIC_PRODUCT_LIST_FETCH_FAILED',
        message: 'Failed to fetch the public product list',
      });
    }
  }

  async getProductDetail(productId: string) {
    try {
      const product = await this.prisma.product.findFirst({
        where: {
          id: productId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          productType: true,
          tokenPrice: true,
          stockQuantity: true,
          isOrderable: true,
          description: true,
          publicationStatus: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          imageFile: {
            select: {
              id: true,
              fileUrl: true,
            },
          },
          _count: {
            select: {
              orders: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException({
          errorCode: 'P404_PRODUCT_NOT_FOUND',
          message: 'Product not found',
        });
      }

      return {
        productId: product.id,
        productName: product.name,
        productType: PRODUCT_TYPE_VALUE_MAP[product.productType],
        tokenPrice: product.tokenPrice,
        stockQuantity: product.stockQuantity,
        isOrderable: product.isOrderable,
        availabilityStatus:
          product.isOrderable && product.stockQuantity > 0
            ? 'available'
            : 'unavailable',
        publicationStatus:
          PUBLICATION_STATUS_VALUE_MAP[product.publicationStatus],
        description: product.description,
        image: product.imageFile
          ? {
              fileId: product.imageFile.id,
              fileUrl: product.imageFile.fileUrl,
            }
          : null,
        coreFieldsLocked: product._count.orders > 0,
        publishedAt: product.publishedAt,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'P500_PRODUCT_FETCH_FAILED',
        message: 'Failed to fetch the product',
      });
    }
  }

  async updateProduct(
    productId: string,
    dto: UpdateProductDto,
    adminId: string,
  ) {
    const hasUpdateField =
      dto.productName !== undefined ||
      dto.tokenPrice !== undefined ||
      dto.stockQuantity !== undefined ||
      dto.isOrderable !== undefined ||
      dto.description !== undefined ||
      dto.imageFileId !== undefined ||
      dto.publicationStatus !== undefined;

    if (!hasUpdateField) {
      throw new BadRequestException({
        errorCode: 'P400_PRODUCT_UPDATE_REQUIRED',
        message: 'At least one product field must be provided',
      });
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existingProduct = await tx.product.findFirst({
          where: {
            id: productId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            productType: true,
            tokenPrice: true,
            stockQuantity: true,
            isOrderable: true,
            description: true,
            imageFileId: true,
            publicationStatus: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            imageFile: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
            _count: {
              select: {
                orders: true,
              },
            },
          },
        });

        if (!existingProduct) {
          throw new NotFoundException({
            errorCode: 'P404_PRODUCT_NOT_FOUND',
            message: 'Product not found',
          });
        }

        const productNameChanged =
          dto.productName !== undefined &&
          dto.productName !== existingProduct.name;

        const tokenPriceChanged =
          dto.tokenPrice !== undefined &&
          dto.tokenPrice !== existingProduct.tokenPrice;

        if (
          existingProduct._count.orders > 0 &&
          (productNameChanged || tokenPriceChanged)
        ) {
          throw new ConflictException({
            errorCode: 'P409_PRODUCT_CORE_FIELDS_LOCKED',
            message:
              'Product name and token price cannot be changed after an order exists',
          });
        }

        const finalProductName = dto.productName ?? existingProduct.name;

        const finalTokenPrice = dto.tokenPrice ?? existingProduct.tokenPrice;

        const finalIsOrderable = dto.isOrderable ?? existingProduct.isOrderable;

        const finalDescription =
          dto.description !== undefined
            ? dto.description
            : existingProduct.description;

        const finalImageFileId =
          dto.imageFileId !== undefined
            ? dto.imageFileId
            : existingProduct.imageFileId;

        const finalPublicationStatus =
          dto.publicationStatus !== undefined
            ? UPDATE_PUBLICATION_STATUS_MAP[dto.publicationStatus]
            : existingProduct.publicationStatus;

        if (
          finalPublicationStatus === PublicationStatus.PUBLISHED &&
          !finalDescription
        ) {
          throw new BadRequestException({
            errorCode: 'P400_PRODUCT_DESCRIPTION_REQUIRED',
            message: 'Description is required for a published product',
          });
        }

        if (
          finalPublicationStatus === PublicationStatus.PUBLISHED &&
          !finalImageFileId
        ) {
          throw new BadRequestException({
            errorCode: 'P400_PRODUCT_IMAGE_REQUIRED',
            message: 'Image is required for a published product',
          });
        }

        const shouldValidateImage =
          finalImageFileId !== null &&
          finalImageFileId !== undefined &&
          (dto.imageFileId !== undefined ||
            finalPublicationStatus === PublicationStatus.PUBLISHED);

        if (shouldValidateImage) {
          const imageFile = await tx.file.findFirst({
            where: {
              id: finalImageFileId,
              deletedAt: null,
            },
            select: {
              id: true,
              status: true,
              purpose: true,
            },
          });

          if (!imageFile) {
            throw new NotFoundException({
              errorCode: 'F404_FILE_NOT_FOUND',
              message: 'File not found',
            });
          }

          if (
            imageFile.status !== FileStatus.COMPLETED ||
            imageFile.purpose !== FilePurpose.PRODUCT_IMAGE
          ) {
            throw new BadRequestException({
              errorCode: 'P400_PRODUCT_IMAGE_INVALID',
              message: 'The file cannot be used as a product image',
            });
          }
        }

        const finalPublishedAt =
          existingProduct.publishedAt ??
          (finalPublicationStatus === PublicationStatus.PUBLISHED
            ? new Date()
            : null);

        const changedFields: string[] = [];

        if (productNameChanged) {
          changedFields.push('productName');
        }

        if (tokenPriceChanged) {
          changedFields.push('tokenPrice');
        }

        if (
          dto.stockQuantity !== undefined &&
          dto.stockQuantity !== existingProduct.stockQuantity
        ) {
          changedFields.push('stockQuantity');
        }

        if (
          dto.isOrderable !== undefined &&
          dto.isOrderable !== existingProduct.isOrderable
        ) {
          changedFields.push('isOrderable');
        }

        if (
          dto.description !== undefined &&
          dto.description !== existingProduct.description
        ) {
          changedFields.push('description');
        }

        if (
          dto.imageFileId !== undefined &&
          dto.imageFileId !== existingProduct.imageFileId
        ) {
          changedFields.push('imageFileId');
        }

        if (
          dto.publicationStatus !== undefined &&
          finalPublicationStatus !== existingProduct.publicationStatus
        ) {
          changedFields.push('publicationStatus');
        }

        if (changedFields.length === 0) {
          return {
            productId: existingProduct.id,
            productName: existingProduct.name,
            productType: PRODUCT_TYPE_VALUE_MAP[existingProduct.productType],
            tokenPrice: existingProduct.tokenPrice,
            stockQuantity: existingProduct.stockQuantity,
            isOrderable: existingProduct.isOrderable,
            availabilityStatus:
              existingProduct.isOrderable && existingProduct.stockQuantity > 0
                ? 'available'
                : 'unavailable',
            publicationStatus:
              PUBLICATION_STATUS_VALUE_MAP[existingProduct.publicationStatus],
            description: existingProduct.description,
            image: existingProduct.imageFile
              ? {
                  fileId: existingProduct.imageFile.id,
                  fileUrl: existingProduct.imageFile.fileUrl,
                }
              : null,
            coreFieldsLocked: existingProduct._count.orders > 0,
            publishedAt: existingProduct.publishedAt,
            createdAt: existingProduct.createdAt,
            updatedAt: existingProduct.updatedAt,
          };
        }

        const updatedProduct = await tx.product.update({
          where: {
            id: productId,
          },
          data: {
            name: finalProductName,
            tokenPrice: finalTokenPrice,
            ...(dto.stockQuantity !== undefined
              ? {
                  stockQuantity: dto.stockQuantity,
                }
              : {}),
            isOrderable: finalIsOrderable,
            description: finalDescription,
            imageFileId: finalImageFileId,
            publicationStatus: finalPublicationStatus,
            publishedAt: finalPublishedAt,
          },
          select: {
            id: true,
            name: true,
            productType: true,
            tokenPrice: true,
            stockQuantity: true,
            isOrderable: true,
            description: true,
            publicationStatus: true,
            publishedAt: true,
            createdAt: true,
            updatedAt: true,
            imageFile: {
              select: {
                id: true,
                fileUrl: true,
              },
            },
          },
        });

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.PRODUCT,
            action: AdminAction.UPDATE_PRODUCT,
            targetId: productId,
            metadata: {
              changedFields,
            },
          },
        });

        return {
          productId: updatedProduct.id,
          productName: updatedProduct.name,
          productType: PRODUCT_TYPE_VALUE_MAP[updatedProduct.productType],
          tokenPrice: updatedProduct.tokenPrice,
          stockQuantity: updatedProduct.stockQuantity,
          isOrderable: updatedProduct.isOrderable,
          availabilityStatus:
            updatedProduct.isOrderable && updatedProduct.stockQuantity > 0
              ? 'available'
              : 'unavailable',
          publicationStatus:
            PUBLICATION_STATUS_VALUE_MAP[updatedProduct.publicationStatus],
          description: updatedProduct.description,
          image: updatedProduct.imageFile
            ? {
                fileId: updatedProduct.imageFile.id,
                fileUrl: updatedProduct.imageFile.fileUrl,
              }
            : null,
          coreFieldsLocked: existingProduct._count.orders > 0,
          publishedAt: updatedProduct.publishedAt,
          createdAt: updatedProduct.createdAt,
          updatedAt: updatedProduct.updatedAt,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'P500_PRODUCT_UPDATE_FAILED',
        message: 'Failed to update the product',
      });
    }
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
            errorCode: 'P409_PRODUCT_CONCURRENT_UPDATE',
            message:
              'Product could not be updated due to a concurrent update. Please try again',
          });
        }
      }
    }

    throw new ConflictException({
      errorCode: 'P409_PRODUCT_CONCURRENT_UPDATE',
      message:
        'Product could not be updated due to a concurrent update. Please try again',
    });
  }
}
