import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { ContentPostCategoryValue } from './create-content-post.dto';
import { AdminContentPostStatusValue } from './get-admin-post-list-query.dto';
import { UpdateContentPostDto } from './update-content-post.dto';

describe('UpdateContentPostDto', () => {
  it('should accept a valid partial update', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {
      title: '  Updated Orientation Day  ',
      status: AdminContentPostStatusValue.PUBLISHED,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.title).toBe('Updated Orientation Day');
  });

  it('should allow nullable removable fields and an empty image list', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {
      content: null,
      eventStartAt: null,
      eventEndAt: null,
      imageFileIds: [],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.content).toBeNull();
    expect(dto.eventStartAt).toBeNull();
    expect(dto.eventEndAt).toBeNull();
    expect(dto.imageFileIds).toEqual([]);
  });

  it('should allow multiple unique categories', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {
      categories: [
        ContentPostCategoryValue.EVENT,
        ContentPostCategoryValue.ANNOUNCEMENT,
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an empty title', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {
      title: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('title');
  });

  it('should reject an empty or duplicate category list', async () => {
    const emptyDto = plainToInstance(UpdateContentPostDto, {
      categories: [],
    });

    const duplicateDto = plainToInstance(UpdateContentPostDto, {
      categories: [
        ContentPostCategoryValue.EVENT,
        ContentPostCategoryValue.EVENT,
      ],
    });

    const emptyErrors = await validate(emptyDto);
    const duplicateErrors = await validate(duplicateDto);

    expect(emptyErrors.map((error) => error.property)).toContain('categories');

    expect(duplicateErrors.map((error) => error.property)).toContain(
      'categories',
    );
  });

  it('should reject more than four image file IDs', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {
      imageFileIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
        '55555555-5555-4555-8555-555555555555',
      ],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('imageFileIds');
  });

  it('should reject a date-time without a timezone', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {
      eventStartAt: '2026-09-10T18:30:00',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('eventStartAt');
  });

  it('should leave empty body validation to the service', async () => {
    const dto = plainToInstance(UpdateContentPostDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
