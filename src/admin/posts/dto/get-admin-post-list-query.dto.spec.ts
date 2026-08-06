import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ContentPostCategoryValue } from './create-content-post.dto';
import {
  AdminContentPostStatusValue,
  AdminPostSortValue,
  GetAdminPostListQueryDto,
} from './get-admin-post-list-query.dto';

describe('GetAdminPostListQueryDto', () => {
  it('should apply the default pagination and sorting values', async () => {
    const dto = plainToInstance(GetAdminPostListQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.size).toBe(10);
    expect(dto.sort).toBe(AdminPostSortValue.LATEST);
  });

  it('should transform numeric query strings and trim the keyword', async () => {
    const dto = plainToInstance(GetAdminPostListQueryDto, {
      keyword: '  Orientation  ',
      category: ContentPostCategoryValue.EVENT,
      status: AdminContentPostStatusValue.PUBLISHED,
      page: '2',
      size: '20',
      sort: AdminPostSortValue.OLDEST,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.keyword).toBe('Orientation');
    expect(dto.page).toBe(2);
    expect(dto.size).toBe(20);
    expect(dto.category).toBe(ContentPostCategoryValue.EVENT);
    expect(dto.status).toBe(AdminContentPostStatusValue.PUBLISHED);
    expect(dto.sort).toBe(AdminPostSortValue.OLDEST);
  });

  it('should reject unsupported category, status, and sort values', async () => {
    const dto = plainToInstance(GetAdminPostListQueryDto, {
      category: 'invalid-category',
      status: 'invalid-status',
      sort: 'invalid-sort',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['category', 'status', 'sort']),
    );
  });

  it('should reject invalid pagination values', async () => {
    const dto = plainToInstance(GetAdminPostListQueryDto, {
      page: '0',
      size: '101',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'size']),
    );
  });
});
