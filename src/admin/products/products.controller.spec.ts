import 'reflect-metadata';

import {
  CreateProductDto,
  CreateProductPublicationStatusValue,
  CreateProductTypeValue,
} from './dto/create-product.dto';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  const productId = '4d2f8c1a-1234-4c11-9f10-abc123456789';

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const createProductMock = jest.fn();

  const productsServiceMock = {
    createProduct: createProductMock,
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
});
