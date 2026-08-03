import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ResetTokenBalancesDto } from './reset-token-balances.dto';

describe('ResetTokenBalancesDto', () => {
  const validateDto = async (payload: unknown) => {
    const dto = plainToInstance(ResetTokenBalancesDto, payload);

    return validate(dto);
  };

  it('should accept a valid request and trim the reason', async () => {
    const dto = plainToInstance(ResetTokenBalancesDto, {
      reason: '  End of Spring 2026 semester  ',
      confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.reason).toBe('End of Spring 2026 semester');
  });

  it('should reject a whitespace-only reason', async () => {
    const errors = await validateDto({
      reason: '   ',
      confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a reason longer than 255 characters', async () => {
    const errors = await validateDto({
      reason: 'a'.repeat(256),
      confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a missing confirmation', async () => {
    const errors = await validateDto({
      reason: 'End of Spring 2026 semester',
    });

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an empty confirmation', async () => {
    const errors = await validateDto({
      reason: 'End of Spring 2026 semester',
      confirmation: '',
    });

    expect(errors.length).toBeGreaterThan(0);
  });
});
