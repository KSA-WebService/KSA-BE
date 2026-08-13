import { Allow } from 'class-validator';
import {
  UserRoleValue,
  UserStatusValue,
} from '../../../common/constants/user-api-values';

export class CompleteOnboardingDto {
  @Allow()
  token?: unknown;

  @Allow()
  password?: unknown;

  @Allow()
  agreedPrivacy?: unknown;
}

export interface CompleteOnboardingResponse {
  userId: string;
  name: string;
  email: string;
  studentNumber: string;
  role: UserRoleValue;
  status: UserStatusValue;
  tokenBalance: number;
  createdAt: string;
}
