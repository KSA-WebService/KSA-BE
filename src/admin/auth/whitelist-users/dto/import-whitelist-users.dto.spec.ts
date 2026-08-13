import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  ImportWhitelistUsersDto,
  WhitelistImportDuplicatePolicy,
} from './import-whitelist-users.dto';

describe('ImportWhitelistUsersDto', () => {
  it('should use skip as the default duplicate policy', async () => {
    const dto = plainToInstance(ImportWhitelistUsersDto, {
      users: [{}],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.onDuplicate).toBe(WhitelistImportDuplicatePolicy.SKIP);
  });

  it('should accept lowercase duplicate policy values', async () => {
    const dto = plainToInstance(ImportWhitelistUsersDto, {
      onDuplicate: 'update',
      users: [{}],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.onDuplicate).toBe(WhitelistImportDuplicatePolicy.UPDATE);
  });

  it('should trim a lowercase duplicate policy value', async () => {
    const dto = plainToInstance(ImportWhitelistUsersDto, {
      onDuplicate: '  fail  ',
      users: [{}],
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.onDuplicate).toBe(WhitelistImportDuplicatePolicy.FAIL);
  });

  it('should reject uppercase legacy duplicate policy values', async () => {
    const dto = plainToInstance(ImportWhitelistUsersDto, {
      onDuplicate: 'UPDATE',
      users: [{}],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('onDuplicate');
  });
});
