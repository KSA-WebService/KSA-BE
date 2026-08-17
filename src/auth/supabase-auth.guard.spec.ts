import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

import { PrismaService } from '../prisma/prisma.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

describe('SupabaseAuthGuard', () => {
  const userId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const getUserMock = jest.fn();
  const userFindUniqueMock = jest.fn();
  const getOrThrowMock = jest.fn();

  const configServiceMock = {
    getOrThrow: getOrThrowMock,
  };

  const prismaServiceMock = {
    user: {
      findUnique: userFindUniqueMock,
    },
  };

  const createClientMock = createClient as jest.MockedFunction<
    typeof createClient
  >;

  let guard: SupabaseAuthGuard;

  const createContext = (authorization?: string) => {
    const request: {
      headers: {
        authorization?: string;
      };
      user?: {
        id: string;
      };
    } = {
      headers: {},
    };

    if (authorization !== undefined) {
      request.headers.authorization = authorization;
    }

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    return {
      context,
      request,
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    getOrThrowMock.mockImplementation((key: string) => {
      if (key === 'SUPABASE_URL') {
        return 'https://example.supabase.co';
      }

      if (key === 'SUPABASE_ANON_KEY') {
        return 'test-anon-key';
      }

      throw new Error(`Unexpected config key: ${key}`);
    });

    createClientMock.mockReturnValue({
      auth: {
        getUser: getUserMock,
      },
    } as unknown as ReturnType<typeof createClient>);

    guard = new SupabaseAuthGuard(
      configServiceMock as unknown as ConfigService,
      prismaServiceMock as unknown as PrismaService,
    );
  });

  it('should reject a request without an authorization header', async () => {
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: {
        errorCode: 'A401_AUTHENTICATION_REQUIRED',
        message: 'Access token is required',
      },
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it('should reject an empty bearer token', async () => {
    const { context } = createContext('Bearer   ');

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: {
        errorCode: 'A401_AUTHENTICATION_REQUIRED',
        message: 'Access token is required',
      },
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(getUserMock).not.toHaveBeenCalled();
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it('should reject an invalid Supabase access token without exposing provider details', async () => {
    const { context } = createContext('Bearer invalid-token');

    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
      error: {
        message: 'Invalid JWT',
        status: 401,
        name: 'AuthApiError',
      },
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: {
        errorCode: 'A401_INVALID_ACCESS_TOKEN',
        message: 'Invalid access token',
        data: null,
      },
    });

    expect(getUserMock).toHaveBeenCalledWith('invalid-token');
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it('should reject a missing Supabase user as an invalid access token', async () => {
    const { context } = createContext('Bearer invalid-token');

    getUserMock.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 401,
      response: {
        errorCode: 'A401_INVALID_ACCESS_TOKEN',
        message: 'Invalid access token',
        data: null,
      },
    });

    expect(getUserMock).toHaveBeenCalledWith('invalid-token');
    expect(userFindUniqueMock).not.toHaveBeenCalled();
  });

  it('should reject an authenticated user that does not exist in the application database', async () => {
    const { context } = createContext('Bearer valid-token');

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: userId,
        },
      },
      error: null,
    });

    userFindUniqueMock.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ACTIVE_USER_REQUIRED',
        message: 'Active user access is required',
      },
    });

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      select: {
        status: true,
        deletedAt: true,
      },
    });
  });

  it('should reject an inactive application user', async () => {
    const { context } = createContext('Bearer valid-token');

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: userId,
        },
      },
      error: null,
    });

    userFindUniqueMock.mockResolvedValue({
      status: UserStatus.BLOCKED,
      deletedAt: null,
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ACTIVE_USER_REQUIRED',
        message: 'Active user access is required',
      },
    });
  });

  it('should reject a soft-deleted application user', async () => {
    const { context } = createContext('Bearer valid-token');

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: userId,
        },
      },
      error: null,
    });

    userFindUniqueMock.mockResolvedValue({
      status: UserStatus.ACTIVE,
      deletedAt: new Date('2026-08-17T00:00:00.000Z'),
    });

    await expect(guard.canActivate(context)).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'A403_ACTIVE_USER_REQUIRED',
        message: 'Active user access is required',
      },
    });
  });

  it('should allow an active user and attach the authenticated user to the request', async () => {
    const { context, request } = createContext('Bearer valid-token');

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: userId,
        },
      },
      error: null,
    });

    userFindUniqueMock.mockResolvedValue({
      status: UserStatus.ACTIVE,
      deletedAt: null,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(createClientMock).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'test-anon-key',
    );

    expect(getUserMock).toHaveBeenCalledWith('valid-token');

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: {
        id: userId,
      },
      select: {
        status: true,
        deletedAt: true,
      },
    });

    expect(request.user).toEqual({
      id: userId,
    });
  });
});
