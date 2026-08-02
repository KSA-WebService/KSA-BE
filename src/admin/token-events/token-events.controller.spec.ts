import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { CreateTokenEventDto } from './dto/create-token-event.dto';
import { TokenEventsController } from './token-events.controller';
import { TokenEventsService } from './token-events.service';
import { GetTokenEventsQueryDto } from './dto/get-token-events-query.dto';
import {
  GetTokenEventDetailQueryDto,
  TokenGrantStatusFilter,
} from './dto/get-token-event-detail-query.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

describe('TokenEventsController', () => {
  let controller: TokenEventsController;

  const tokenEventsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
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
      controllers: [TokenEventsController],
      providers: [
        {
          provide: TokenEventsService,
          useValue: tokenEventsServiceMock,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(SupabaseAuthGuard)
      .useValue(supabaseAuthGuardMock);

    moduleBuilder.overrideGuard(AdminGuard).useValue(adminGuardMock);

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<TokenEventsController>(TokenEventsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass the DTO and authenticated admin ID to the service', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const dto: CreateTokenEventDto = {
      eventName: 'KSA Welcome Event',
    };

    const createdAt = new Date('2026-08-02T06:30:00.000Z');

    const result = {
      tokenEventId: '3f6e9f0a-1234-4c11-9f10-abc123456789',
      eventName: 'KSA Welcome Event',
      createdBy: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      createdAt,
    };

    tokenEventsServiceMock.create.mockResolvedValue(result);

    const request = {
      user: {
        id: adminId,
      },
    } as AuthenticatedRequest;

    await expect(controller.create(dto, request)).resolves.toEqual(result);

    expect(tokenEventsServiceMock.create).toHaveBeenCalledTimes(1);
    expect(tokenEventsServiceMock.create).toHaveBeenCalledWith(dto, adminId);
  });

  it('should pass the query DTO to the service', async () => {
    const query: GetTokenEventsQueryDto = {
      page: 1,
      limit: 20,
      keyword: 'Welcome',
    };

    const result = {
      items: [],
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
    };

    tokenEventsServiceMock.findAll.mockResolvedValue(result);

    await expect(controller.findAll(query)).resolves.toEqual(result);

    expect(tokenEventsServiceMock.findAll).toHaveBeenCalledTimes(1);
    expect(tokenEventsServiceMock.findAll).toHaveBeenCalledWith(query);
  });

  it('should pass the token event ID and query DTO to the service', async () => {
    const tokenEventId = '3f6e9f0a-1234-4c11-9f10-abc123456789';

    const query: GetTokenEventDetailQueryDto = {
      page: 1,
      limit: 20,
      keyword: 'Sulynn',
      grantStatus: TokenGrantStatusFilter.ALL,
    };

    const result = {
      tokenEventId,
      eventName: 'KSA Welcome Event',
      createdBy: {
        userId: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
        name: 'Sulynn Kim',
      },
      createdAt: new Date('2026-08-02T06:30:00.000Z'),
      eventUpdatedAt: new Date('2026-08-02T06:30:00.000Z'),
      lastGrantUpdatedAt: null,
      grantedMemberCount: 0,
      items: [],
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
    };

    tokenEventsServiceMock.findOne.mockResolvedValue(result);

    await expect(controller.findOne(tokenEventId, query)).resolves.toEqual(
      result,
    );

    expect(tokenEventsServiceMock.findOne).toHaveBeenCalledTimes(1);
    expect(tokenEventsServiceMock.findOne).toHaveBeenCalledWith(
      tokenEventId,
      query,
    );
  });
});
