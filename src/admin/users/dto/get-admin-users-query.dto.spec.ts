import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  UserRoleValue,
  UserStatusValue,
} from '../../../common/constants/user-api-values';
import {
  AdminUserSortField,
  GetAdminUsersQueryDto,
} from './get-admin-users-query.dto';
describe('GetAdminUsersQueryDto', () => {
  it('should accept lowercase user role and status values', async () => {
    const dto = plainToInstance(GetAdminUsersQueryDto, {
      role: UserRoleValue.STUDENT,
      status: UserStatusValue.ACTIVE,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.role).toBe(UserRoleValue.STUDENT);
    expect(dto.status).toBe(UserStatusValue.ACTIVE);
  });

  it('should reject uppercase Prisma enum values', async () => {
    const dto = plainToInstance(GetAdminUsersQueryDto, {
      role: 'STUDENT',
      status: 'ACTIVE',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['role', 'status']),
    );
  });

  it('should accept lowercase snake_case sort values', async () => {
    const dto = plainToInstance(GetAdminUsersQueryDto, {
      sort: AdminUserSortField.STUDENT_NUMBER,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sort).toBe('student_number');
  });

  it('should reject camelCase sort values', async () => {
    const dto = plainToInstance(GetAdminUsersQueryDto, {
      sort: 'studentNumber',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('sort');
  });
});
