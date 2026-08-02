import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetTokenEventsQueryDto } from './get-token-events-query.dto';

describe('GetTokenEventsQueryDto', () => {
  it('should apply the default page and limit', async () => {
    const dto = plainToInstance(GetTokenEventsQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.keyword).toBeUndefined();
  });

  it('should transform numeric query strings and trim keyword', async () => {
    const dto = plainToInstance(GetTokenEventsQueryDto, {
      page: '2',
      limit: '50',
      keyword: '  Welcome  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(50);
    expect(dto.keyword).toBe('Welcome');
  });

  it('should treat a whitespace-only keyword as absent', async () => {
    const dto = plainToInstance(GetTokenEventsQueryDto, {
      keyword: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.keyword).toBeUndefined();
  });

  it.each([
    {
      page: '0',
      limit: '20',
    },
    {
      page: '1.5',
      limit: '20',
    },
    {
      page: '1',
      limit: '0',
    },
    {
      page: '1',
      limit: '101',
    },
  ])('should reject invalid pagination values', async (input) => {
    const dto = plainToInstance(GetTokenEventsQueryDto, input);

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
