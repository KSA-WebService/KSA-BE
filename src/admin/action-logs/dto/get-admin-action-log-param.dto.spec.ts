import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { GetAdminActionLogParamDto } from './get-admin-action-log-param.dto';

describe('GetAdminActionLogParamDto', () => {
  async function validateDto(payload: Record<string, unknown>) {
    const dto = plainToInstance(GetAdminActionLogParamDto, payload);

    const errors = await validate(dto);

    return {
      dto,
      errors,
    };
  }

  it('should transform logId into a number', async () => {
    const { dto, errors } = await validateDto({
      logId: '152',
    });

    expect(errors).toHaveLength(0);
    expect(dto.logId).toBe(152);
  });

  it('should accept a positive integer logId', async () => {
    const { errors } = await validateDto({
      logId: 1,
    });

    expect(errors).toHaveLength(0);
  });

  it('should reject zero', async () => {
    const { errors } = await validateDto({
      logId: 0,
    });

    expect(errors.some((error) => error.property === 'logId')).toBe(true);
  });

  it('should reject a negative logId', async () => {
    const { errors } = await validateDto({
      logId: -1,
    });

    expect(errors.some((error) => error.property === 'logId')).toBe(true);
  });

  it('should reject a non-integer logId', async () => {
    const { errors } = await validateDto({
      logId: '1.5',
    });

    expect(errors.some((error) => error.property === 'logId')).toBe(true);
  });

  it('should reject a non-numeric logId', async () => {
    const { errors } = await validateDto({
      logId: 'abc',
    });

    expect(errors.some((error) => error.property === 'logId')).toBe(true);
  });
});
