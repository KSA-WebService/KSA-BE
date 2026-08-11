import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { GetAdminActionLogsQueryDto } from './get-admin-action-logs-query.dto';

describe('GetAdminActionLogsQueryDto', () => {
  async function validateDto(payload: Record<string, unknown>) {
    const dto = plainToInstance(GetAdminActionLogsQueryDto, payload);

    const errors = await validate(dto);

    return {
      dto,
      errors,
    };
  }

  it('should apply the default query values', async () => {
    const { dto, errors } = await validateDto({});

    expect(errors).toHaveLength(0);

    expect(dto).toEqual({
      page: 1,
      limit: 20,
      sort: 'latest',
    });
  });

  it('should transform page and limit query strings into numbers', async () => {
    const { dto, errors } = await validateDto({
      page: '2',
      limit: '50',
    });

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('should accept all supported action types', async () => {
    const actionTypes = [
      'user',
      'whitelist',
      'invitation',
      'content',
      'product',
      'order',
      'token',
      'file',
      'memo',
    ];

    for (const actionType of actionTypes) {
      const { errors } = await validateDto({
        actionType,
      });

      expect(errors).toHaveLength(0);
    }
  });

  it('should reject an unsupported action type', async () => {
    const { errors } = await validateDto({
      actionType: 'unknown',
    });

    expect(errors.some((error) => error.property === 'actionType')).toBe(true);
  });

  it('should accept latest and oldest sorting', async () => {
    const latest = await validateDto({
      sort: 'latest',
    });

    const oldest = await validateDto({
      sort: 'oldest',
    });

    expect(latest.errors).toHaveLength(0);
    expect(oldest.errors).toHaveLength(0);
  });

  it('should reject an unsupported sort value', async () => {
    const { errors } = await validateDto({
      sort: 'ascending',
    });

    expect(errors.some((error) => error.property === 'sort')).toBe(true);
  });

  it('should accept a valid UUID v4 admin ID', async () => {
    const { errors } = await validateDto({
      adminId: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
    });

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid admin ID', async () => {
    const { errors } = await validateDto({
      adminId: 'not-a-uuid',
    });

    expect(errors.some((error) => error.property === 'adminId')).toBe(true);
  });

  it('should reject a page below 1', async () => {
    const { errors } = await validateDto({
      page: 0,
    });

    expect(errors.some((error) => error.property === 'page')).toBe(true);
  });

  it('should reject a limit below 1', async () => {
    const { errors } = await validateDto({
      limit: 0,
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('should reject a limit above 100', async () => {
    const { errors } = await validateDto({
      limit: 101,
    });

    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });
});
