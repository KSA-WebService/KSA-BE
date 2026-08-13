import { validate } from 'class-validator';

import {
  UserRoleValue,
  UserStatusValue,
} from '../../../common/constants/user-api-values';
import { UpdateAdminUserDto } from './update-admin-user.dto';

describe('UpdateAdminUserDto', () => {
  it('should accept lowercase user role and status values', async () => {
    const dto = new UpdateAdminUserDto();

    dto.role = UserRoleValue.ADMIN;
    dto.status = UserStatusValue.ACTIVE;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject uppercase Prisma enum values', async () => {
    const dto = Object.assign(new UpdateAdminUserDto(), {
      role: 'ADMIN',
      status: 'ACTIVE',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['role', 'status']),
    );
  });
});
