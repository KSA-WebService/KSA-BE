import {
  AdminAction,
  AdminActionType,
  ContentPostCategoryType,
  FilePurpose,
  FileStatus,
  PublicationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  ContentPostCategoryValue,
  CreateContentPostDto,
  CreateContentPostStatus,
} from './dto/create-content-post.dto';
import { PostsService } from './posts.service';

describe('PostsService', () => {
  const fixedNow = new Date('2026-08-06T00:00:00.000Z');

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const postId = '8bc95b8f-cbd1-45ed-b2ef-f80dd06e92db';

  const fileId1 = '421c9cce-db39-471f-a49a-5da4d28f74c0';

  const fileId2 = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const fileId3 = '1f3a2b1c-4444-4d22-8e20-def987654321';

  const fileId4 = '2f3a2b1c-5555-4d22-8e20-def987654321';

  const fileFindManyMock = jest.fn();
  const contentPostCreateMock = jest.fn();
  const adminActionLogCreateMock = jest.fn();
  const transactionMock = jest.fn();

  const transactionClientMock = {
    file: {
      findMany: fileFindManyMock,
    },
    contentPost: {
      create: contentPostCreateMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
  };

  type TransactionCallback = (
    transaction: typeof transactionClientMock,
  ) => Promise<unknown>;

  const prismaMock = {
    $transaction: transactionMock,
  };

  const service = new PostsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);

    transactionMock.mockImplementation(async (callback: TransactionCallback) =>
      callback(transactionClientMock),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create a draft post without optional fields', async () => {
    const dto: CreateContentPostDto = {
      title: 'Orientation Day',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
    };

    contentPostCreateMock.mockResolvedValue({
      id: postId,
      title: dto.title,
      membersOnly: false,
      status: PublicationStatus.DRAFT,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
      publishedAt: null,
      createdAt: fixedNow,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(service.createPost(dto, adminId)).resolves.toEqual({
      postId,
      title: dto.title,
      categories: dto.categories,
      membersOnly: false,
      status: CreateContentPostStatus.DRAFT,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
      images: [],
      publishedAt: null,
      createdAt: fixedNow,
    });

    expect(fileFindManyMock).not.toHaveBeenCalled();

    expect(contentPostCreateMock).toHaveBeenCalledWith({
      data: {
        authorId: adminId,
        title: dto.title,
        content: null,
        status: PublicationStatus.DRAFT,
        membersOnly: false,
        publishedAt: null,
        eventStartAt: null,
        eventEndAt: null,
        showOnCalendar: false,
        categories: {
          create: [
            {
              category: ContentPostCategoryType.EVENT,
            },
          ],
        },
        images: undefined,
      },
      select: {
        id: true,
        title: true,
        membersOnly: true,
        status: true,
        eventStartAt: true,
        eventEndAt: true,
        showOnCalendar: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.CONTENT,
        targetId: postId,
        action: AdminAction.CREATE_CONTENT_POST,
        metadata: {
          title: dto.title,
          categories: [ContentPostCategoryType.EVENT],
          membersOnly: false,
          status: PublicationStatus.DRAFT,
          imageCount: 0,
          showOnCalendar: false,
        },
      },
    });
  });

  it('should publish a post with multiple categories and four ordered images', async () => {
    const dto: CreateContentPostDto = {
      title: 'Members-only Career Talk',
      content:
        '📌 Career talk details\n• Venue: HKUST\n• Registration required',
      categories: [
        ContentPostCategoryValue.CAREER,
        ContentPostCategoryValue.EVENT,
        ContentPostCategoryValue.ALUMNI,
      ],
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      eventStartAt: '2026-09-10T18:30:00+08:00',
      eventEndAt: '2026-09-10T20:00:00+08:00',
      showOnCalendar: true,
      imageFileIds: [fileId1, fileId2, fileId3, fileId4],
    };

    const files = [
      {
        id: fileId3,
        fileUrl: 'https://example.com/image-3.png',
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
      {
        id: fileId1,
        fileUrl: 'https://example.com/image-1.png',
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
      {
        id: fileId4,
        fileUrl: 'https://example.com/image-4.png',
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
      {
        id: fileId2,
        fileUrl: 'https://example.com/image-2.png',
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
    ];

    const eventStartAt = new Date('2026-09-10T10:30:00.000Z');

    const eventEndAt = new Date('2026-09-10T12:00:00.000Z');

    fileFindManyMock.mockResolvedValue(files);

    contentPostCreateMock.mockResolvedValue({
      id: postId,
      title: dto.title,
      membersOnly: true,
      status: PublicationStatus.PUBLISHED,
      eventStartAt,
      eventEndAt,
      showOnCalendar: true,
      publishedAt: fixedNow,
      createdAt: fixedNow,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    const result = await service.createPost(dto, adminId);

    expect(fileFindManyMock).toHaveBeenCalledWith({
      where: {
        id: {
          in: [fileId1, fileId2, fileId3, fileId4],
        },
      },
      select: {
        id: true,
        fileUrl: true,
        status: true,
        purpose: true,
        deletedAt: true,
      },
    });

    expect(contentPostCreateMock).toHaveBeenCalledWith({
      data: {
        authorId: adminId,
        title: dto.title,
        content: dto.content,
        status: PublicationStatus.PUBLISHED,
        membersOnly: true,
        publishedAt: fixedNow,
        eventStartAt,
        eventEndAt,
        showOnCalendar: true,
        categories: {
          create: [
            {
              category: ContentPostCategoryType.CAREER,
            },
            {
              category: ContentPostCategoryType.EVENT,
            },
            {
              category: ContentPostCategoryType.ALUMNI,
            },
          ],
        },
        images: {
          create: [
            {
              fileId: fileId1,
              sortOrder: 1,
            },
            {
              fileId: fileId2,
              sortOrder: 2,
            },
            {
              fileId: fileId3,
              sortOrder: 3,
            },
            {
              fileId: fileId4,
              sortOrder: 4,
            },
          ],
        },
      },
      select: {
        id: true,
        title: true,
        membersOnly: true,
        status: true,
        eventStartAt: true,
        eventEndAt: true,
        showOnCalendar: true,
        publishedAt: true,
        createdAt: true,
      },
    });

    expect(result).toEqual({
      postId,
      title: dto.title,
      categories: dto.categories,
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      eventStartAt,
      eventEndAt,
      showOnCalendar: true,
      images: [
        {
          fileId: fileId1,
          fileUrl: 'https://example.com/image-1.png',
          sortOrder: 1,
        },
        {
          fileId: fileId2,
          fileUrl: 'https://example.com/image-2.png',
          sortOrder: 2,
        },
        {
          fileId: fileId3,
          fileUrl: 'https://example.com/image-3.png',
          sortOrder: 3,
        },
        {
          fileId: fileId4,
          fileUrl: 'https://example.com/image-4.png',
          sortOrder: 4,
        },
      ],
      publishedAt: fixedNow,
      createdAt: fixedNow,
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.CONTENT,
        targetId: postId,
        action: AdminAction.CREATE_CONTENT_POST,
        metadata: {
          title: dto.title,
          categories: [
            ContentPostCategoryType.CAREER,
            ContentPostCategoryType.EVENT,
            ContentPostCategoryType.ALUMNI,
          ],
          membersOnly: true,
          status: PublicationStatus.PUBLISHED,
          imageCount: 4,
          showOnCalendar: true,
        },
      },
    });
  });

  it('should allow a start time without an end time', async () => {
    const dto: CreateContentPostDto = {
      title: 'Open-ended Event',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      eventStartAt: '2026-09-10T18:30:00+08:00',
      eventEndAt: null,
      showOnCalendar: false,
    };

    const eventStartAt = new Date('2026-09-10T10:30:00.000Z');

    contentPostCreateMock.mockResolvedValue({
      id: postId,
      title: dto.title,
      membersOnly: false,
      status: PublicationStatus.DRAFT,
      eventStartAt,
      eventEndAt: null,
      showOnCalendar: false,
      publishedAt: null,
      createdAt: fixedNow,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(service.createPost(dto, adminId)).resolves.toMatchObject({
      eventStartAt,
      eventEndAt: null,
    });
  });

  it('should reject an end time without a start time', async () => {
    const dto: CreateContentPostDto = {
      title: 'Invalid Event',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      eventEndAt: '2026-09-10T20:00:00+08:00',
    };

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'C400_EVENT_START_REQUIRED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject an end time earlier than the start time', async () => {
    const dto: CreateContentPostDto = {
      title: 'Invalid Event Period',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      eventStartAt: '2026-09-10T20:00:00+08:00',
      eventEndAt: '2026-09-10T18:30:00+08:00',
    };

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'C400_INVALID_EVENT_PERIOD',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should require a start time when calendar visibility is enabled', async () => {
    const dto: CreateContentPostDto = {
      title: 'Calendar Post',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      showOnCalendar: true,
    };

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'C400_CALENDAR_START_REQUIRED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a missing image file', async () => {
    const dto: CreateContentPostDto = {
      title: 'Post with Missing Image',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      imageFileIds: [fileId1, fileId2],
    };

    fileFindManyMock.mockResolvedValue([
      {
        id: fileId1,
        fileUrl: 'https://example.com/image-1.png',
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
    ]);

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'F404_FILE_NOT_FOUND',
        data: {
          fileId: fileId2,
        },
      },
    });

    expect(contentPostCreateMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an incomplete image file', async () => {
    const dto: CreateContentPostDto = {
      title: 'Post with Pending Image',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      imageFileIds: [fileId1],
    };

    fileFindManyMock.mockResolvedValue([
      {
        id: fileId1,
        fileUrl: 'https://example.com/image-1.png',
        status: FileStatus.PENDING,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
    ]);

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_NOT_AVAILABLE',
        data: {
          fileId: fileId1,
        },
      },
    });

    expect(contentPostCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a deleted image file', async () => {
    const dto: CreateContentPostDto = {
      title: 'Post with Deleted Image',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      imageFileIds: [fileId1],
    };

    fileFindManyMock.mockResolvedValue([
      {
        id: fileId1,
        fileUrl: 'https://example.com/image-1.png',
        status: FileStatus.DELETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: fixedNow,
      },
    ]);

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_NOT_AVAILABLE',
        data: {
          fileId: fileId1,
        },
      },
    });

    expect(contentPostCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an image with a non-post purpose', async () => {
    const dto: CreateContentPostDto = {
      title: 'Post with Invalid Image',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
      imageFileIds: [fileId1],
    };

    fileFindManyMock.mockResolvedValue([
      {
        id: fileId1,
        fileUrl: 'https://example.com/image-1.png',
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.PRODUCT_IMAGE,
        deletedAt: null,
      },
    ]);

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_PURPOSE_MISMATCH',
        data: {
          fileId: fileId1,
        },
      },
    });

    expect(contentPostCreateMock).not.toHaveBeenCalled();
  });

  it('should return a creation error when the transaction fails', async () => {
    const dto: CreateContentPostDto = {
      title: 'Failed Post',
      categories: [ContentPostCategoryValue.ANNOUNCEMENT],
      status: CreateContentPostStatus.DRAFT,
    };

    transactionMock.mockRejectedValue(new Error('Database failure'));

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_CREATE_FAILED',
      },
    });
  });

  it('should return a creation error when audit log creation fails', async () => {
    const dto: CreateContentPostDto = {
      title: 'Audit Failure Post',
      categories: [ContentPostCategoryValue.ANNOUNCEMENT],
      status: CreateContentPostStatus.DRAFT,
    };

    contentPostCreateMock.mockResolvedValue({
      id: postId,
      title: dto.title,
      membersOnly: false,
      status: PublicationStatus.DRAFT,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
      publishedAt: null,
      createdAt: fixedNow,
    });

    adminActionLogCreateMock.mockRejectedValue(new Error('Audit log failure'));

    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_CREATE_FAILED',
      },
    });

    expect(contentPostCreateMock).toHaveBeenCalledTimes(1);

    expect(adminActionLogCreateMock).toHaveBeenCalledTimes(1);
  });
});
