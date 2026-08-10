import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  ListPublicProductsQueryDto,
  PublicProductSort,
  PublicProductTypeFilter,
} from './list-public-products-query.dto';

describe('ListPublicProductsQueryDto', () => {
  it('should apply default pagination and sorting values', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(12);
    expect(dto.sort).toBe(PublicProductSort.LATEST);
  });

  it('should transform page and limit query strings into numbers', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {
      page: '2',
      limit: '6',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(6);
  });

  it('should validate supported product types', async () => {
    for (const productType of [
      PublicProductTypeFilter.TICKET,
      PublicProductTypeFilter.MERCHANDISE,
    ]) {
      const dto = plainToInstance(ListPublicProductsQueryDto, {
        productType,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('should validate supported sort values', async () => {
    for (const sort of [PublicProductSort.LATEST, PublicProductSort.OLDEST]) {
      const dto = plainToInstance(ListPublicProductsQueryDto, {
        sort,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('should reject page values below one', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {
      page: 0,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('page');
  });

  it('should reject limit values below one', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {
      limit: 0,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('limit');
  });

  it('should reject limit values above fifty', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {
      limit: 51,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('limit');
  });

  it('should reject an unsupported product type', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {
      productType: 'all',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('productType');
  });

  it('should reject an unsupported sort value', async () => {
    const dto = plainToInstance(ListPublicProductsQueryDto, {
      sort: 'popular',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('sort');
  });
});
