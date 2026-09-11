import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateWhitelistUserDto } from './update-whitelist-user.dto';

describe('UpdateWhitelistUserDto', () => {
  it('should accept a partial identity correction with a reason', async () => {
    const dto = plainToInstance(UpdateWhitelistUserDto, {
      email: '  Corrected@connect.ust.hk  ',
      reason: '  Corrected after student inquiry  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('corrected@connect.ust.hk');
    expect(dto.reason).toBe('Corrected after student inquiry');
  });

  it('should accept name and student number corrections without email', async () => {
    const dto = plainToInstance(UpdateWhitelistUserDto, {
      name: '  HKUST Student  ',
      studentNumber: '  20912345  ',
      reason: 'Verified against the official student list',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.name).toBe('HKUST Student');
    expect(dto.studentNumber).toBe('20912345');
  });

  it('should reject a non-HKUST Connect email', async () => {
    const dto = plainToInstance(UpdateWhitelistUserDto, {
      email: 'student@gmail.com',
      reason: 'Corrected email',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('email');
  });

  it('should reject an empty reason', async () => {
    const dto = plainToInstance(UpdateWhitelistUserDto, {
      name: 'Corrected Name',
      reason: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('reason');
  });

  it('should reject a name longer than 128 characters', async () => {
    const dto = plainToInstance(UpdateWhitelistUserDto, {
      name: 'a'.repeat(129),
      reason: 'Corrected name',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('name');
  });

  it('should reject a reason longer than 500 characters', async () => {
    const dto = plainToInstance(UpdateWhitelistUserDto, {
      name: 'Corrected Name',
      reason: 'a'.repeat(501),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('reason');
  });
});
