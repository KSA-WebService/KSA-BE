import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  AdminProductAvailabilityStatusFilter,
  AdminProductPublicationStatusFilter,
  AdminProductSort,
  AdminProductTypeFilter,
  ListProductsQueryDto,
} from './list-products-query.dto';

describe('ListProductsQueryDto', () => {
  it('should apply default pagination and sorting values', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort).toBe(AdminProductSort.LATEST);
  });

  it('should transform page and limit query strings into numbers', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      page: '2',
      limit: '10',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('should trim the keyword', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      keyword: '  hoodie  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.keyword).toBe('hoodie');
  });

  it('should treat a whitespace-only keyword as undefined', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      keyword: '     ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.keyword).toBeUndefined();
  });

  it('should validate supported filters', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      productType: AdminProductTypeFilter.TICKET,
      publicationStatus: AdminProductPublicationStatusFilter.PUBLISHED,
      availabilityStatus: AdminProductAvailabilityStatusFilter.AVAILABLE,
      sort: AdminProductSort.OLDEST,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject page values below one', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      page: 0,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('page');
  });

  it('should reject limit values below one', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      limit: 0,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('limit');
  });

  it('should reject limit values above one hundred', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      limit: 101,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('limit');
  });

  it('should reject unsupported product types', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      productType: 'coupon',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('productType');
  });

  it('should reject unsupported publication statuses', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      publicationStatus: 'deleted',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'publicationStatus',
    );
  });

  it('should reject unsupported availability statuses', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      availabilityStatus: 'sold_out',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'availabilityStatus',
    );
  });

  it('should reject unsupported sort values', async () => {
    const dto = plainToInstance(ListProductsQueryDto, {
      sort: 'popular',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('sort');
  });
});
