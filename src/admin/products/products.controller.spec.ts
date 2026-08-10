import 'reflect-metadata';

import {
  CreateProductDto,
  CreateProductPublicationStatusValue,
  CreateProductTypeValue,
} from './dto/create-product.dto';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import {
  AdminProductSort,
  ListProductsQueryDto,
} from './dto/list-products-query.dto';
import {
  UpdateProductDto,
  UpdateProductPublicationStatusValue,
} from './dto/update-product.dto';

describe('ProductsController', () => {
  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const createProductMock = jest.fn();
  const getProductListMock = jest.fn();
  const getProductDetailMock = jest.fn();
  const updateProductMock = jest.fn();

  const productsServiceMock = {
    createProduct: createProductMock,
    getProductList: getProductListMock,
    getProductDetail: getProductDetailMock,
    updateProduct: updateProductMock,
  };

  const controller = new ProductsController(
    productsServiceMock as unknown as ProductsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should pass the product DTO and administrator ID to the service', async () => {
    const dto: CreateProductDto = {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      isOrderable: true,
      description: 'Ticket for the KSA lucky draw event.',
      imageFileId: '9f3a2b1c-3333-4d22-8e20-def987654321',
      publicationStatus: CreateProductPublicationStatusValue.PUBLISHED,
    };

    const request = {
      user: {
        id: adminId,
      },
    };

    const expected = {
      productId,
      productName: 'Lucky Draw Ticket',
    };

    createProductMock.mockResolvedValue(expected);

    await expect(controller.createProduct(dto, request)).resolves.toEqual(
      expected,
    );

    expect(createProductMock).toHaveBeenCalledTimes(1);

    expect(createProductMock).toHaveBeenCalledWith(dto, adminId);
  });

  it('should pass the product ID to the service when retrieving product detail', async () => {
    const expected = {
      productId,
      productName: 'KSA Hoodie',
      productType: 'merchandise',
      tokenPrice: 150,
    };

    getProductDetailMock.mockResolvedValue(expected);

    await expect(controller.getProductDetail(productId)).resolves.toEqual(
      expected,
    );

    expect(getProductDetailMock).toHaveBeenCalledTimes(1);
    expect(getProductDetailMock).toHaveBeenCalledWith(productId);
  });

  it('should pass the product list query to the service', async () => {
    const query: ListProductsQueryDto = {
      page: 1,
      limit: 20,
      keyword: 'hoodie',
      sort: AdminProductSort.LATEST,
    };

    const expected = {
      items: [],
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
    };

    getProductListMock.mockResolvedValue(expected);

    await expect(controller.getProductList(query)).resolves.toEqual(expected);

    expect(getProductListMock).toHaveBeenCalledTimes(1);

    expect(getProductListMock).toHaveBeenCalledWith(query);
  });

  it('should pass the product ID, update DTO, and administrator ID to the service', async () => {
    const dto: UpdateProductDto = {
      stockQuantity: 15,
      isOrderable: false,
      publicationStatus: UpdateProductPublicationStatusValue.HIDDEN,
    };

    const request = {
      user: {
        id: adminId,
      },
    };

    const expected = {
      productId,
      stockQuantity: 15,
      isOrderable: false,
      publicationStatus: 'hidden',
    };

    updateProductMock.mockResolvedValue(expected);

    await expect(
      controller.updateProduct(productId, dto, request),
    ).resolves.toEqual(expected);

    expect(updateProductMock).toHaveBeenCalledTimes(1);

    expect(updateProductMock).toHaveBeenCalledWith(productId, dto, adminId);
  });
});
