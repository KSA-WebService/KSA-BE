import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  GetPublicPostListQueryDto,
  PublicContentPostCategoryValue,
  PublicPostPeriodValue,
  PublicPostSortValue,
} from './get-public-post-list-query.dto';

describe('GetPublicPostListQueryDto', () => {
  it('should apply the default query values', async () => {
    const dto = plainToInstance(GetPublicPostListQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.period).toBe(PublicPostPeriodValue.ALL);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
    expect(dto.sort).toBe(PublicPostSortValue.LATEST);
  });

  it('should trim the keyword and transform numeric query values', async () => {
    const dto = plainToInstance(GetPublicPostListQueryDto, {
      keyword: '  Orientation  ',
      category: PublicContentPostCategoryValue.EVENT,
      period: PublicPostPeriodValue.UPCOMING,
      page: '2',
      limit: '20',
      sort: PublicPostSortValue.OLDEST,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.keyword).toBe('Orientation');
    expect(dto.category).toBe(PublicContentPostCategoryValue.EVENT);
    expect(dto.period).toBe(PublicPostPeriodValue.UPCOMING);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
    expect(dto.sort).toBe(PublicPostSortValue.OLDEST);
  });

  it('should reject unsupported category, period, and sort values', async () => {
    const dto = plainToInstance(GetPublicPostListQueryDto, {
      category: 'invalid-category',
      period: 'invalid-period',
      sort: 'invalid-sort',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['category', 'period', 'sort']),
    );
  });

  it('should reject pagination values outside the allowed range', async () => {
    const dto = plainToInstance(GetPublicPostListQueryDto, {
      page: '0',
      limit: '101',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'limit']),
    );
  });

  it('should reject non-numeric pagination values', async () => {
    const dto = plainToInstance(GetPublicPostListQueryDto, {
      page: 'abc',
      limit: 'test',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'limit']),
    );
  });

  it('should reject non-integer pagination values', async () => {
    const dto = plainToInstance(GetPublicPostListQueryDto, {
      page: '1.5',
      limit: '10.5',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'limit']),
    );
  });
});
