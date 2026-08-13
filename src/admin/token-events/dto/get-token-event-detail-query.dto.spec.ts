import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TokenGrantStatusValue } from '../../../common/constants/token-api-values';
import { GetTokenEventDetailQueryDto } from './get-token-event-detail-query.dto';

describe('GetTokenEventDetailQueryDto', () => {
  it('should apply default query values', async () => {
    const dto = plainToInstance(GetTokenEventDetailQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.keyword).toBeUndefined();
    expect(dto.grantStatus).toBe(TokenGrantStatusValue.ALL);
  });

  it('should transform pagination and trim keyword', async () => {
    const dto = plainToInstance(GetTokenEventDetailQueryDto, {
      page: '2',
      limit: '50',
      keyword: '  Sulynn  ',
      grantStatus: 'granted',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.keyword).toBe('Sulynn');
    expect(dto.grantStatus).toBe(TokenGrantStatusValue.GRANTED);
  });

  it('should treat a whitespace-only keyword as absent', async () => {
    const dto = plainToInstance(GetTokenEventDetailQueryDto, {
      keyword: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.keyword).toBeUndefined();
  });

  it.each([
    TokenGrantStatusValue.ALL,
    TokenGrantStatusValue.GRANTED,
    TokenGrantStatusValue.NOT_GRANTED,
  ])('should accept grant status %s', async (grantStatus) => {
    const dto = plainToInstance(GetTokenEventDetailQueryDto, {
      grantStatus,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an unsupported grant status', async () => {
    const dto = plainToInstance(GetTokenEventDetailQueryDto, {
      grantStatus: 'INVALID',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([
    { page: '0', limit: '20' },
    { page: '1.5', limit: '20' },
    { page: '1', limit: '0' },
    { page: '1', limit: '101' },
  ])('should reject invalid pagination values', async (input) => {
    const dto = plainToInstance(GetTokenEventDetailQueryDto, input);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
