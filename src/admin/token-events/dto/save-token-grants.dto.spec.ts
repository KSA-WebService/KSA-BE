import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveTokenGrantsDto } from './save-token-grants.dto';

describe('SaveTokenGrantsDto', () => {
  const firstUserId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const secondUserId = 'a8d91c2e-2222-4a11-9f10-abc123456789';

  it('should accept valid grants and trim reasons', async () => {
    const dto = plainToInstance(SaveTokenGrantsDto, {
      grants: [
        {
          userId: firstUserId,
          grantedAmount: 1,
          reason: '  Attendance  ',
        },
        {
          userId: secondUserId,
          grantedAmount: 5,
          reason: 'Event helper',
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.grants[0].reason).toBe('Attendance');
    expect(dto.grants[1].reason).toBe('Event helper');
  });

  it('should reject duplicate user IDs', async () => {
    const dto = plainToInstance(SaveTokenGrantsDto, {
      grants: [
        {
          userId: firstUserId,
          grantedAmount: 1,
          reason: 'Attendance',
        },
        {
          userId: firstUserId,
          grantedAmount: 2,
          reason: 'Event helper',
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it.each([-1, 1001, 1.5])(
    'should reject invalid grantedAmount %s',
    async (grantedAmount) => {
      const dto = plainToInstance(SaveTokenGrantsDto, {
        grants: [
          {
            userId: firstUserId,
            grantedAmount,
            reason: 'Attendance',
          },
        ],
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it('should reject a numeric string grantedAmount', async () => {
    const dto = plainToInstance(SaveTokenGrantsDto, {
      grants: [
        {
          userId: firstUserId,
          grantedAmount: '5',
          reason: 'Attendance',
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a whitespace-only reason', async () => {
    const dto = plainToInstance(SaveTokenGrantsDto, {
      grants: [
        {
          userId: firstUserId,
          grantedAmount: 1,
          reason: '   ',
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an empty grants array', async () => {
    const dto = plainToInstance(SaveTokenGrantsDto, {
      grants: [],
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
