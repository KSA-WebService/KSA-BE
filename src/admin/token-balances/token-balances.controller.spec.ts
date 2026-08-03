import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ResetTokenBalancesDto } from './dto/reset-token-balances.dto';
import { TokenBalancesController } from './token-balances.controller';
import { TokenBalancesService } from './token-balances.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

describe('TokenBalancesController', () => {
  let controller: TokenBalancesController;

  const tokenBalancesServiceMock = {
    getResetPreview: jest.fn(),
    resetTokenBalances: jest.fn(),
  };

  const supabaseAuthGuardMock = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  const adminGuardMock = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleBuilder = Test.createTestingModule({
      controllers: [TokenBalancesController],
      providers: [
        {
          provide: TokenBalancesService,
          useValue: tokenBalancesServiceMock,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(SupabaseAuthGuard)
      .useValue(supabaseAuthGuardMock);

    moduleBuilder.overrideGuard(AdminGuard).useValue(adminGuardMock);

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<TokenBalancesController>(TokenBalancesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return the token balance reset preview', async () => {
    const previewedAt = new Date('2026-08-03T04:00:00.000Z');

    const expected = {
      affectedMemberCount: 35,
      totalResetAmount: 142,
      previewedAt,
    };

    tokenBalancesServiceMock.getResetPreview.mockResolvedValue(expected);

    await expect(controller.getResetPreview()).resolves.toEqual(expected);

    expect(tokenBalancesServiceMock.getResetPreview).toHaveBeenCalledTimes(1);
  });

  it('should pass the reset request and admin ID to the service', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const body: ResetTokenBalancesDto = {
      reason: 'End of Spring 2026 semester',
      confirmation: 'RESET_ALL_STUDENT_TOKEN_BALANCES',
    };

    const performedAt = new Date('2026-08-03T04:00:00.000Z');

    const expected = {
      affectedMemberCount: 35,
      totalResetAmount: 142,
      reason: 'End of Spring 2026 semester',
      performedBy: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      performedAt,
    };

    tokenBalancesServiceMock.resetTokenBalances.mockResolvedValue(expected);

    const request = {
      user: {
        id: adminId,
      },
    } as AuthenticatedRequest;

    await expect(controller.resetTokenBalances(body, request)).resolves.toEqual(
      expected,
    );

    expect(tokenBalancesServiceMock.resetTokenBalances).toHaveBeenCalledTimes(
      1,
    );

    expect(tokenBalancesServiceMock.resetTokenBalances).toHaveBeenCalledWith(
      body,
      adminId,
    );
  });
});
