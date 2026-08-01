import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const prismaServiceMock = {
    user: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the current active user profile', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    prismaServiceMock.user.findFirst.mockResolvedValue({
      id: userId,
      name: 'Sulynn Kim',
      studentNumber: '20912345',
      email: 'user@connect.ust.hk',
      role: UserRole.STUDENT,
      tokenBalance: 9,
      status: UserStatus.ACTIVE,
      agreedPrivacy: true,
      agreedAt: null,
    });

    await expect(service.findMe(userId)).resolves.toEqual({
      userId,
      name: 'Sulynn Kim',
      studentNumber: '20912345',
      email: 'user@connect.ust.hk',
      role: UserRole.STUDENT,
      tokenBalance: 9,
      status: UserStatus.ACTIVE,
      agreedPrivacy: true,
      agreedAt: null,
    });

    expect(prismaServiceMock.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        studentNumber: true,
        email: true,
        role: true,
        tokenBalance: true,
        status: true,
        agreedPrivacy: true,
        agreedAt: true,
      },
    });
  });

  it('should return A403 when an active user profile is unavailable', async () => {
    const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    prismaServiceMock.user.findFirst.mockResolvedValue(null);

    try {
      await service.findMe(userId);

      throw new Error('Expected findMe to throw a ForbiddenException');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(ForbiddenException);

      if (!(error instanceof ForbiddenException)) {
        throw error;
      }

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toEqual({
        errorCode: 'A403',
        message: 'Active user access is required',
      });
    }
  });
});
