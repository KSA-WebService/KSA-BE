import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { WhitelistInvitationStatusValue } from '../../../../common/constants/invitation-api-values';
import {
  GetWhitelistUsersQueryDto,
  WhitelistUserSortField,
} from './get-whitelist-users-query.dto';

describe('GetWhitelistUsersQueryDto', () => {
  it('should accept lowercase invitation status values', async () => {
    const dto = plainToInstance(GetWhitelistUsersQueryDto, {
      invitationStatus: WhitelistInvitationStatusValue.INVITED,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.invitationStatus).toBe(WhitelistInvitationStatusValue.INVITED);
  });

  it('should reject uppercase Prisma invitation status values', async () => {
    const dto = plainToInstance(GetWhitelistUsersQueryDto, {
      invitationStatus: 'INVITED',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('invitationStatus');
  });

  it('should keep the default pagination and sorting values', async () => {
    const dto = plainToInstance(GetWhitelistUsersQueryDto, {});

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sort).toBe('name');
    expect(dto.order).toBe('asc');
  });

  it('should accept lowercase snake_case sort values', async () => {
    const dto = plainToInstance(GetWhitelistUsersQueryDto, {
      sort: WhitelistUserSortField.INVITATION_STATUS,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.sort).toBe('invitation_status');
  });

  it('should reject camelCase sort values', async () => {
    const dto = plainToInstance(GetWhitelistUsersQueryDto, {
      sort: 'invitationStatus',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('sort');
  });
});
