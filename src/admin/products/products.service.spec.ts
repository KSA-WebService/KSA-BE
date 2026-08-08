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

describe('ProductsService', () => {
  const fixedNow = new Date('2026-08-08T00:00:00.000Z');

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';

  const fileId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const fileFindFirstMock = jest.fn();
  const productCreateMock = jest.fn();
  const adminActionLogCreateMock = jest.fn();
  const transactionMock = jest.fn();

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
});
