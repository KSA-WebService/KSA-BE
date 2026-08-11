import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { GetAdminOrdersQueryDto } from './get-admin-orders-query.dto';

describe('GetAdminOrdersQueryDto', () => {
  async function validateDto(payload: Record<string, unknown>) {
    const dto = plainToInstance(GetAdminOrdersQueryDto, payload);
    const errors = await validate(dto);

    return {
      dto,
      errors,
    };
  }

  it('should apply default pagination and sorting values', async () => {
    const { dto, errors } = await validateDto({});

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort).toBe('latest');
    expect(dto.keyword).toBeUndefined();
    expect(dto.orderStatus).toBeUndefined();
  });

  it('should accept valid query parameters', async () => {
    const { dto, errors } = await validateDto({
      page: '2',
      limit: '10',
      keyword: 'Sulynn',
      orderStatus: 'ordered',
      sort: 'oldest',
    });

    expect(errors).toHaveLength(0);

    expect(dto).toMatchObject({
      page: 2,
      limit: 10,
      keyword: 'Sulynn',
      orderStatus: 'ordered',
      sort: 'oldest',
    });
  });

  it('should accept every supported order status', async () => {
    for (const orderStatus of [
      'ordered',
      'accepted',
      'delivered',
      'canceled',
    ]) {
      const { errors } = await validateDto({
        orderStatus,
      });

      expect(errors).toHaveLength(0);
    }
  });

  it('should reject page values less than 1', async () => {
    const { errors } = await validateDto({
      page: '0',
    });

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('should reject limit values less than 1', async () => {
    const { errors } = await validateDto({
      limit: '0',
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('should reject limit values greater than 100', async () => {
    const { errors } = await validateDto({
      limit: '101',
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('should reject non-integer pagination values', async () => {
    const { errors } = await validateDto({
      page: '1.5',
      limit: '10.5',
    });

    expect(errors.some((error) => error.property === 'page')).toBe(true);

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('should reject an unsupported order status', async () => {
    const { errors } = await validateDto({
      orderStatus: 'refunded',
    });

    expect(errors.some((error) => error.property === 'orderStatus')).toBe(true);
  });

  it('should reject an unsupported sort value', async () => {
    const { errors } = await validateDto({
      sort: 'ascending',
    });

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('should reject a keyword longer than 255 characters', async () => {
    const { errors } = await validateDto({
      keyword: 'a'.repeat(256),
    });

    expect(errors.some((error) => error.property === 'keyword')).toBe(true);
  });

  it('should accept an empty keyword', async () => {
    const { errors } = await validateDto({
      keyword: '',
    });

    expect(errors).toHaveLength(0);
  });

  it('should accept a whitespace-only keyword', async () => {
    const { errors } = await validateDto({
      keyword: '   ',
    });

    expect(errors).toHaveLength(0);
  });
});
