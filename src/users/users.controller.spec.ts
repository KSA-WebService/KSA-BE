import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetMyTokenLogsQueryDto } from './dto/get-my-token-logs-query.dto';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

describe('UsersController', () => {
  let controller: UsersController;

  const usersServiceMock = {
    findMe: jest.fn(),
    findMyTokenLogs: jest.fn(),
  };

  const supabaseAuthGuardMock = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleBuilder = Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(SupabaseAuthGuard)
      .useValue(supabaseAuthGuardMock);

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the authenticated user ID to UsersService', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const profile = {
      userId,
      name: 'Sulynn Kim',
      studentNumber: '20912345',
      email: 'user@connect.ust.hk',
      role: 'STUDENT',
      tokenBalance: 0,
      status: 'ACTIVE',
      agreedPrivacy: false,
      agreedAt: null,
    };

    usersServiceMock.findMe.mockResolvedValue(profile);

    const request = {
      user: {
        id: userId,
      },
    } as AuthenticatedRequest;

    await expect(controller.getMe(request)).resolves.toEqual(profile);

    expect(usersServiceMock.findMe).toHaveBeenCalledTimes(1);

    expect(usersServiceMock.findMe).toHaveBeenCalledWith(userId);
  });

  it('should pass the authenticated user ID and pagination query to UsersService', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const query: GetMyTokenLogsQueryDto = {
      page: 2,
      limit: 20,
    };

    const expected = {
      currentTokenBalance: 5,
      items: [],
      page: 2,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
    };

    usersServiceMock.findMyTokenLogs.mockResolvedValue(expected);

    const request = {
      user: {
        id: userId,
      },
    } as AuthenticatedRequest;

    await expect(controller.getMyTokenLogs(request, query)).resolves.toEqual(
      expected,
    );

    expect(usersServiceMock.findMyTokenLogs).toHaveBeenCalledTimes(1);

    expect(usersServiceMock.findMyTokenLogs).toHaveBeenCalledWith(
      userId,
      query,
    );
  });
});
