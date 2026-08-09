import {
  BadRequestException,
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
      return await this.prisma.$transaction(async (tx) => {
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
}
