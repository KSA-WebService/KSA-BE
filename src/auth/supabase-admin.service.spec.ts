import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseAdminService } from './supabase-admin.service';

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

const createClientMock = jest.mocked(createClient);

describe('SupabaseAdminService', () => {
  const storagePath =
    'post-images/2026/08/9f3a2b1c-3333-4d22-8e20-def987654321.png';

  const infoMock = jest.fn();
  const removeMock = jest.fn();
  const fromMock = jest.fn();

  let service: SupabaseAdminService;

  beforeEach(() => {
    jest.clearAllMocks();

    const storageBucketMock = {
      info: infoMock,
      remove: removeMock,
    };

    fromMock.mockReturnValue(storageBucketMock);

    const clientMock = {
      storage: {
        from: fromMock,
      },
    };

    createClientMock.mockReturnValue(
      clientMock as unknown as ReturnType<typeof createClient>,
    );

    const configServiceMock = {
      getOrThrow: jest.fn((key: string) => {
        const values: Record<string, string> = {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SECRET_KEY: 'test-secret-key',
          SUPABASE_STORAGE_BUCKET: 'public-images',
        };

        return values[key];
      }),
    };

    service = new SupabaseAdminService(
      configServiceMock as unknown as ConfigService,
    );
  });

  it('should delete an existing Storage object', async () => {
    infoMock.mockResolvedValue({
      data: {
        size: 204800,
        contentType: 'image/png',
      },
      error: null,
    });

    removeMock.mockResolvedValue({
      data: [
        {
          name: storagePath,
        },
      ],
      error: null,
    });

    await expect(service.deleteStoredImage(storagePath)).resolves.toBe(
      'DELETED',
    );

    expect(fromMock).toHaveBeenCalledWith('public-images');

    expect(infoMock).toHaveBeenCalledWith(storagePath);

    expect(removeMock).toHaveBeenCalledWith([storagePath]);
  });

  it('should return NOT_FOUND when the Storage object does not exist', async () => {
    infoMock.mockResolvedValue({
      data: null,
      error: {
        statusCode: 404,
      },
    });

    await expect(service.deleteStoredImage(storagePath)).resolves.toBe(
      'NOT_FOUND',
    );

    expect(removeMock).not.toHaveBeenCalled();
  });

  it('should return NOT_FOUND when the object disappears before removal', async () => {
    infoMock.mockResolvedValue({
      data: {
        size: 204800,
        contentType: 'image/png',
      },
      error: null,
    });

    removeMock.mockResolvedValue({
      data: null,
      error: {
        statusCode: 404,
      },
    });

    await expect(service.deleteStoredImage(storagePath)).resolves.toBe(
      'NOT_FOUND',
    );
  });

  it('should propagate an unexpected Storage info error', async () => {
    const storageError = {
      statusCode: 500,
      message: 'Storage unavailable',
    };

    infoMock.mockResolvedValue({
      data: null,
      error: storageError,
    });

    await expect(service.deleteStoredImage(storagePath)).rejects.toBe(
      storageError,
    );

    expect(removeMock).not.toHaveBeenCalled();
  });

  it('should propagate an unexpected Storage deletion error', async () => {
    const storageError = {
      statusCode: 500,
      message: 'Storage unavailable',
    };

    infoMock.mockResolvedValue({
      data: {
        size: 204800,
        contentType: 'image/png',
      },
      error: null,
    });

    removeMock.mockResolvedValue({
      data: null,
      error: storageError,
    });

    await expect(service.deleteStoredImage(storagePath)).rejects.toBe(
      storageError,
    );
  });

  it('should return NOT_FOUND when Storage reports no removed objects', async () => {
    infoMock.mockResolvedValue({
      data: {
        size: 204800,
        contentType: 'image/png',
      },
      error: null,
    });

    removeMock.mockResolvedValue({
      data: [],
      error: null,
    });

    await expect(service.deleteStoredImage(storagePath)).resolves.toBe(
      'NOT_FOUND',
    );
  });
});
