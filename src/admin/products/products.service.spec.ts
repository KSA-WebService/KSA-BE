import 'reflect-metadata';

import {
  AdminAction,
  AdminActionType,
  FilePurpose,
  FileStatus,
  ProductType,
  PublicationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateProductDto,
  CreateProductPublicationStatusValue,
  CreateProductTypeValue,
} from './dto/create-product.dto';
import { ProductsService } from './products.service';

import {
  AdminProductAvailabilityStatusFilter,
  AdminProductPublicationStatusFilter,
  AdminProductSort,
  AdminProductTypeFilter,
  ListProductsQueryDto,
} from './dto/list-products-query.dto';

describe('ProductsService', () => {
  const fixedNow = new Date('2026-08-08T00:00:00.000Z');

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';

  const fileId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const fileFindFirstMock = jest.fn();
  const productCreateMock = jest.fn();
  const adminActionLogCreateMock = jest.fn();
  const transactionMock = jest.fn();
  const productFindFirstMock = jest.fn();
  const productFindManyMock = jest.fn();
  const productCountMock = jest.fn();

  const transactionClientMock = {
    file: {
      findFirst: fileFindFirstMock,
    },
    product: {
      create: productCreateMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
  };

  type TransactionCallback = (
    transaction: typeof transactionClientMock,
  ) => Promise<unknown>;

  const prismaMock = {
    $transaction: transactionMock,
    product: {
      findFirst: productFindFirstMock,
      findMany: productFindManyMock,
      count: productCountMock,
    },
  };

  const service = new ProductsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    transactionMock.mockImplementation(async (callback: TransactionCallback) =>
      callback(transactionClientMock),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create a draft product without optional fields', async () => {
    const dto: CreateProductDto = {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    productCreateMock.mockResolvedValue({
      id: productId,
      name: 'Lucky Draw Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      isOrderable: true,
      description: null,
      publicationStatus: PublicationStatus.DRAFT,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: null,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 'audit-log-id',
    });

    await expect(service.createProduct(dto, adminId)).resolves.toEqual({
      productId,
      productName: 'Lucky Draw Ticket',
      productType: 'ticket',
      tokenPrice: 10,
      stockQuantity: 100,
      isOrderable: true,
      availabilityStatus: 'available',
      publicationStatus: 'draft',
      description: null,
      image: null,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });

    expect(fileFindFirstMock).not.toHaveBeenCalled();

    expect(productCreateMock).toHaveBeenCalledWith({
      data: {
        name: 'Lucky Draw Ticket',
        productType: ProductType.TICKET,
        tokenPrice: 10,
        stockQuantity: 100,
        isOrderable: true,
        description: null,
        imageFileId: null,
        publicationStatus: PublicationStatus.DRAFT,
        publishedAt: null,
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

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.PRODUCT,
        action: AdminAction.CREATE_PRODUCT,
        targetId: productId,
        metadata: {
          productName: 'Lucky Draw Ticket',
          productType: 'ticket',
          publicationStatus: 'draft',
        },
      },
    });
  });

  it('should create a published product with a valid product image', async () => {
    const dto: CreateProductDto = {
      productName: 'KSA Hoodie',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      description: 'Official KSA hoodie for HKUST students.',
      imageFileId: fileId,
      publicationStatus: CreateProductPublicationStatusValue.PUBLISHED,
    };

    fileFindFirstMock.mockResolvedValue({
      id: fileId,
      status: FileStatus.COMPLETED,
      purpose: FilePurpose.PRODUCT_IMAGE,
    });

    productCreateMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      productType: ProductType.MERCHANDISE,
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      description: 'Official KSA hoodie for HKUST students.',
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: {
        id: fileId,
        fileUrl: 'https://example.com/ksa-hoodie.png',
      },
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 'audit-log-id',
    });

    await expect(service.createProduct(dto, adminId)).resolves.toEqual({
      productId,
      productName: 'KSA Hoodie',
      productType: 'merchandise',
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      availabilityStatus: 'available',
      publicationStatus: 'published',
      description: 'Official KSA hoodie for HKUST students.',
      image: {
        fileId,
        fileUrl: 'https://example.com/ksa-hoodie.png',
      },
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });

    expect(fileFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: fileId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        purpose: true,
      },
    });

    expect(productCreateMock).toHaveBeenCalledWith({
      data: {
        name: 'KSA Hoodie',
        productType: ProductType.MERCHANDISE,
        tokenPrice: 150,
        stockQuantity: 20,
        isOrderable: true,
        description: 'Official KSA hoodie for HKUST students.',
        imageFileId: fileId,
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt: fixedNow,
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
  });

  it('should reject a published product without a description', async () => {
    const dto: CreateProductDto = {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      imageFileId: fileId,
      publicationStatus: CreateProductPublicationStatusValue.PUBLISHED,
    };

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'P400_PRODUCT_DESCRIPTION_REQUIRED',
        message: 'Description is required for a published product',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a published product without an image', async () => {
    const dto: CreateProductDto = {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      description: 'Ticket for the KSA lucky draw.',
      publicationStatus: CreateProductPublicationStatusValue.PUBLISHED,
    };

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'P400_PRODUCT_IMAGE_REQUIRED',
        message: 'Image is required for a published product',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a missing image file', async () => {
    const dto: CreateProductDto = {
      productName: 'Draft Product',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 50,
      stockQuantity: 10,
      imageFileId: fileId,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    fileFindFirstMock.mockResolvedValue(null);

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'F404_FILE_NOT_FOUND',
        message: 'File not found',
      },
    });

    expect(productCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an incomplete product image', async () => {
    const dto: CreateProductDto = {
      productName: 'Draft Product',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 50,
      stockQuantity: 10,
      imageFileId: fileId,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    fileFindFirstMock.mockResolvedValue({
      id: fileId,
      status: FileStatus.PENDING,
      purpose: FilePurpose.PRODUCT_IMAGE,
    });

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'P400_PRODUCT_IMAGE_INVALID',
        message: 'The file cannot be used as a product image',
      },
    });

    expect(productCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a file with a non-product-image purpose', async () => {
    const dto: CreateProductDto = {
      productName: 'Draft Product',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 50,
      stockQuantity: 10,
      imageFileId: fileId,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    fileFindFirstMock.mockResolvedValue({
      id: fileId,
      status: FileStatus.COMPLETED,
      purpose: FilePurpose.POST_IMAGE,
    });

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'P400_PRODUCT_IMAGE_INVALID',
        message: 'The file cannot be used as a product image',
      },
    });

    expect(productCreateMock).not.toHaveBeenCalled();
  });

  it('should return unavailable when stock quantity is zero', async () => {
    const dto: CreateProductDto = {
      productName: 'Sold Out Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 20,
      stockQuantity: 0,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    productCreateMock.mockResolvedValue({
      id: productId,
      name: 'Sold Out Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 20,
      stockQuantity: 0,
      isOrderable: true,
      description: null,
      publicationStatus: PublicationStatus.DRAFT,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: null,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 'audit-log-id',
    });

    const result = await service.createProduct(dto, adminId);

    expect(result.availabilityStatus).toBe('unavailable');
  });

  it('should return unavailable when ordering is manually disabled', async () => {
    const dto: CreateProductDto = {
      productName: 'Paused Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 20,
      stockQuantity: 100,
      isOrderable: false,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    productCreateMock.mockResolvedValue({
      id: productId,
      name: 'Paused Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 20,
      stockQuantity: 100,
      isOrderable: false,
      description: null,
      publicationStatus: PublicationStatus.DRAFT,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: null,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 'audit-log-id',
    });

    const result = await service.createProduct(dto, adminId);

    expect(result.availabilityStatus).toBe('unavailable');
  });

  it('should return a creation error when the transaction fails unexpectedly', async () => {
    const dto: CreateProductDto = {
      productName: 'Test Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 10,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    transactionMock.mockRejectedValueOnce(new Error('Database failure'));

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'P500_PRODUCT_CREATE_FAILED',
        message: 'Failed to create the product',
      },
    });
  });

  it('should return a creation error when audit log creation fails', async () => {
    const dto: CreateProductDto = {
      productName: 'Test Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 10,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    };

    productCreateMock.mockResolvedValue({
      id: productId,
      name: 'Test Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 10,
      stockQuantity: 10,
      isOrderable: true,
      description: null,
      publicationStatus: PublicationStatus.DRAFT,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: null,
    });

    adminActionLogCreateMock.mockRejectedValueOnce(
      new Error('Audit log failure'),
    );

    await expect(service.createProduct(dto, adminId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'P500_PRODUCT_CREATE_FAILED',
        message: 'Failed to create the product',
      },
    });
  });

  it('should return the detailed information of a published product', async () => {
    productFindFirstMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      productType: ProductType.MERCHANDISE,
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      description: 'Official KSA hoodie for HKUST students.',
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: {
        id: fileId,
        fileUrl: 'https://example.com/ksa-hoodie.png',
      },
      _count: {
        orders: 0,
      },
    });

    await expect(service.getProductDetail(productId)).resolves.toEqual({
      productId,
      productName: 'KSA Hoodie',
      productType: 'merchandise',
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      availabilityStatus: 'available',
      publicationStatus: 'published',
      description: 'Official KSA hoodie for HKUST students.',
      image: {
        fileId,
        fileUrl: 'https://example.com/ksa-hoodie.png',
      },
      coreFieldsLocked: false,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });

    expect(productFindFirstMock).toHaveBeenCalledWith({
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

    expect(transactionMock).not.toHaveBeenCalled();
    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return a draft product without a description or image', async () => {
    productFindFirstMock.mockResolvedValue({
      id: productId,
      name: 'Lucky Draw Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      isOrderable: true,
      description: null,
      publicationStatus: PublicationStatus.DRAFT,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: null,
      _count: {
        orders: 0,
      },
    });

    await expect(service.getProductDetail(productId)).resolves.toEqual({
      productId,
      productName: 'Lucky Draw Ticket',
      productType: 'ticket',
      tokenPrice: 10,
      stockQuantity: 100,
      isOrderable: true,
      availabilityStatus: 'available',
      publicationStatus: 'draft',
      description: null,
      image: null,
      coreFieldsLocked: false,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt: fixedNow,
    });
  });

  it('should lock core fields when the product has at least one order', async () => {
    productFindFirstMock.mockResolvedValue({
      id: productId,
      name: 'KSA Hoodie',
      productType: ProductType.MERCHANDISE,
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      description: 'Official KSA hoodie.',
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: {
        id: fileId,
        fileUrl: 'https://example.com/ksa-hoodie.png',
      },
      _count: {
        orders: 1,
      },
    });

    const result = await service.getProductDetail(productId);

    expect(result.coreFieldsLocked).toBe(true);
  });

  it('should return unavailable when the product has zero stock', async () => {
    productFindFirstMock.mockResolvedValue({
      id: productId,
      name: 'Sold Out Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 20,
      stockQuantity: 0,
      isOrderable: true,
      description: 'Lucky draw ticket.',
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: {
        id: fileId,
        fileUrl: 'https://example.com/ticket.png',
      },
      _count: {
        orders: 0,
      },
    });

    const result = await service.getProductDetail(productId);

    expect(result.availabilityStatus).toBe('unavailable');
  });

  it('should return unavailable when ordering is manually disabled', async () => {
    productFindFirstMock.mockResolvedValue({
      id: productId,
      name: 'Paused Ticket',
      productType: ProductType.TICKET,
      tokenPrice: 20,
      stockQuantity: 100,
      isOrderable: false,
      description: 'Temporarily unavailable.',
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: {
        id: fileId,
        fileUrl: 'https://example.com/ticket.png',
      },
      _count: {
        orders: 0,
      },
    });

    const result = await service.getProductDetail(productId);

    expect(result.availabilityStatus).toBe('unavailable');
  });

  it('should return hidden products to administrators', async () => {
    productFindFirstMock.mockResolvedValue({
      id: productId,
      name: 'Hidden Merchandise',
      productType: ProductType.MERCHANDISE,
      tokenPrice: 100,
      stockQuantity: 10,
      isOrderable: false,
      description: 'Hidden product.',
      publicationStatus: PublicationStatus.HIDDEN,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt: fixedNow,
      imageFile: {
        id: fileId,
        fileUrl: 'https://example.com/product.png',
      },
      _count: {
        orders: 0,
      },
    });

    const result = await service.getProductDetail(productId);

    expect(result.publicationStatus).toBe('hidden');
  });

  it('should return product not found when the product does not exist', async () => {
    productFindFirstMock.mockResolvedValue(null);

    await expect(service.getProductDetail(productId)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'P404_PRODUCT_NOT_FOUND',
        message: 'Product not found',
      },
    });
  });

  it('should return a fetch error when the database query fails unexpectedly', async () => {
    productFindFirstMock.mockRejectedValueOnce(new Error('Database failure'));

    await expect(service.getProductDetail(productId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'P500_PRODUCT_FETCH_FAILED',
        message: 'Failed to fetch the product',
      },
    });
  });

  it('should return the paginated administrator product list', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([
      {
        id: productId,
        name: 'KSA Hoodie',
        productType: ProductType.MERCHANDISE,
        tokenPrice: 150,
        stockQuantity: 20,
        isOrderable: true,
        publicationStatus: PublicationStatus.PUBLISHED,
        updatedAt: fixedNow,
        imageFile: {
          id: fileId,
          fileUrl: 'https://example.com/ksa-hoodie.png',
        },
      },
    ]);

    productCountMock.mockResolvedValue(1);

    await expect(service.getProductList(query)).resolves.toEqual({
      items: [
        {
          productId,
          productName: 'KSA Hoodie',
          productType: 'merchandise',
          tokenPrice: 150,
          stockQuantity: 20,
          isOrderable: true,
          availabilityStatus: 'available',
          publicationStatus: 'published',
          image: {
            fileId,
            fileUrl: 'https://example.com/ksa-hoodie.png',
          },
          updatedAt: fixedNow,
        },
      ],
      page: 1,
      limit: 20,
      totalCount: 1,
      totalPages: 1,
    });

    expect(productFindManyMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
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
          updatedAt: 'desc',
        },
        {
          id: 'desc',
        },
      ],
      skip: 0,
      take: 20,
    });

    expect(productCountMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should apply pagination correctly', async () => {
    const query: ListProductsQueryDto = {
      page: 3,
      limit: 10,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(45);

    const result = await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );

    expect(result.page).toBe(3);
    expect(result.limit).toBe(10);
    expect(result.totalCount).toBe(45);
    expect(result.totalPages).toBe(5);
  });

  it('should filter products by a case-insensitive name keyword', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      keyword: 'hoodie',
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          name: {
            contains: 'hoodie',
            mode: 'insensitive',
          },
        },
      }),
    );

    expect(productCountMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
        name: {
          contains: 'hoodie',
          mode: 'insensitive',
        },
      },
    });
  });

  it('should combine product type and publication status filters', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      productType: AdminProductTypeFilter.TICKET,
      publicationStatus: AdminProductPublicationStatusFilter.PUBLISHED,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          productType: ProductType.TICKET,
          publicationStatus: PublicationStatus.PUBLISHED,
        },
      }),
    );
  });

  it('should filter available products', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      availabilityStatus: AdminProductAvailabilityStatusFilter.AVAILABLE,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          isOrderable: true,
          stockQuantity: {
            gt: 0,
          },
        },
      }),
    );
  });

  it('should filter unavailable products', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      availabilityStatus: AdminProductAvailabilityStatusFilter.UNAVAILABLE,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          OR: [
            {
              isOrderable: false,
            },
            {
              stockQuantity: {
                lte: 0,
              },
            },
          ],
        },
      }),
    );
  });

  it('should combine all product list filters', async () => {
    const query: ListProductsQueryDto = {
      page: 2,
      limit: 10,
      keyword: 'ticket',
      productType: AdminProductTypeFilter.TICKET,
      publicationStatus: AdminProductPublicationStatusFilter.PUBLISHED,
      availabilityStatus: AdminProductAvailabilityStatusFilter.AVAILABLE,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          name: {
            contains: 'ticket',
            mode: 'insensitive',
          },
          productType: ProductType.TICKET,
          publicationStatus: PublicationStatus.PUBLISHED,
          isOrderable: true,
          stockQuantity: {
            gt: 0,
          },
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('should sort products by oldest updated time', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      sort: AdminProductSort.OLDEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await service.getProductList(query);

    expect(productFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          {
            updatedAt: 'asc',
          },
          {
            id: 'asc',
          },
        ],
      }),
    );
  });

  it('should return null image for products without an image', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([
      {
        id: productId,
        name: 'Draft Ticket',
        productType: ProductType.TICKET,
        tokenPrice: 10,
        stockQuantity: 100,
        isOrderable: true,
        publicationStatus: PublicationStatus.DRAFT,
        updatedAt: fixedNow,
        imageFile: null,
      },
    ]);

    productCountMock.mockResolvedValue(1);

    const result = await service.getProductList(query);

    expect(result.items[0]).toMatchObject({
      publicationStatus: 'draft',
      image: null,
    });
  });
  it('should return unavailable for a zero-stock product', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([
      {
        id: productId,
        name: 'Sold Out Ticket',
        productType: ProductType.TICKET,
        tokenPrice: 10,
        stockQuantity: 0,
        isOrderable: true,
        publicationStatus: PublicationStatus.PUBLISHED,
        updatedAt: fixedNow,
        imageFile: null,
      },
    ]);

    productCountMock.mockResolvedValue(1);

    const result = await service.getProductList(query);

    expect(result.items[0].availabilityStatus).toBe('unavailable');
  });

  it('should return unavailable when product ordering is disabled', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([
      {
        id: productId,
        name: 'Paused Ticket',
        productType: ProductType.TICKET,
        tokenPrice: 10,
        stockQuantity: 100,
        isOrderable: false,
        publicationStatus: PublicationStatus.PUBLISHED,
        updatedAt: fixedNow,
        imageFile: null,
      },
    ]);

    productCountMock.mockResolvedValue(1);

    const result = await service.getProductList(query);

    expect(result.items[0].availabilityStatus).toBe('unavailable');
  });

  it('should return an empty successful result when no products match', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      keyword: 'does-not-exist',
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockResolvedValue([]);
    productCountMock.mockResolvedValue(0);

    await expect(service.getProductList(query)).resolves.toEqual({
      items: [],
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
    });
  });

  it('should return a list fetch error when the database query fails unexpectedly', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      sort: AdminProductSort.LATEST,
    };

    productFindManyMock.mockRejectedValueOnce(new Error('Database failure'));

    productCountMock.mockResolvedValue(0);

    await expect(service.getProductList(query)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'P500_PRODUCT_LIST_FETCH_FAILED',
        message: 'Failed to fetch the product list',
      },
    });
  });
});
