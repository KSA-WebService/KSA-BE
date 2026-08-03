import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetMyTokenLogsQueryDto } from './get-my-token-logs-query.dto';

describe('GetMyTokenLogsQueryDto', () => {
  it('should use the default pagination values', async () => {
    const dto = plainToInstance(GetMyTokenLogsQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
  });

  it('should transform valid query strings into numbers', async () => {
    const dto = plainToInstance(GetMyTokenLogsQueryDto, {
      page: '2',
      limit: '50',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
  });

  it('should reject a page smaller than 1', async () => {
    const dto = plainToInstance(GetMyTokenLogsQueryDto, {
      page: '0',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a limit greater than 100', async () => {
    const dto = plainToInstance(GetMyTokenLogsQueryDto, {
      limit: '101',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-integer pagination values', async () => {
    const dto = plainToInstance(GetMyTokenLogsQueryDto, {
      page: '1.5',
      limit: '20.5',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
