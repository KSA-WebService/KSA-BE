import { UserRole, UserStatus } from '@prisma/client';
import { Allow } from 'class-validator';

export class CompleteOnboardingDto {
  @Allow()
  token?: unknown;

  @Allow()
  password?: unknown;

  @Allow()
  agreedPrivacy?: unknown;
}

export interface CompleteOnboardingResponse {
  id: string;
  name: string;
  email: string;
  studentNumber: string;
  role: UserRole;
  status: UserStatus;
  tokenBalance: number;
  createdAt: string;
}
