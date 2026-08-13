import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateWhitelistUserDto } from './create-whitelist-user.dto';

describe('CreateWhitelistUserDto', () => {
  const createValidPayload = () => ({
    name: 'HKUST Student',
    studentNumber: '20912345',
    email: 'student@connect.ust.hk',
  });

  it('should accept a name with exactly 128 characters', async () => {
    const dto = plainToInstance(CreateWhitelistUserDto, {
      ...createValidPayload(),
      name: 'a'.repeat(128),
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject a name longer than 128 characters', async () => {
    const dto = plainToInstance(CreateWhitelistUserDto, {
      ...createValidPayload(),
      name: 'a'.repeat(129),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('name');
  });
});
