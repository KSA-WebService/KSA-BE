import { Test, TestingModule } from '@nestjs/testing';

import {
  ListPublicProductsQueryDto,
  PublicProductSort,
} from './dto/list-public-products-query.dto';
import { ProductsService } from './products.service';
import { PublicProductsController } from './public-products.controller';

describe('PublicProductsController', () => {
  let controller: PublicProductsController;

  const getPublicProductListMock = jest.fn();

  const productsServiceMock = {
    getPublicProductList: getPublicProductListMock,
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: productsServiceMock,
        },
      ],
    }).compile();

    controller = module.get<PublicProductsController>(PublicProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the public product list query to the service', async () => {
    const query: ListPublicProductsQueryDto = {
      page: 1,
      limit: 12,
      sort: PublicProductSort.LATEST,
    };

    const expected = {
      items: [],
      page: 1,
      limit: 12,
      totalCount: 0,
      totalPages: 0,
    };

    getPublicProductListMock.mockResolvedValue(expected);

    await expect(controller.getProductList(query)).resolves.toEqual(expected);

    expect(getPublicProductListMock).toHaveBeenCalledTimes(1);

    expect(getPublicProductListMock).toHaveBeenCalledWith(query);
  });
});
