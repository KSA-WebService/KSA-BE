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
import {
  AdminContentPostStatusValue,
  AdminPostSortValue,
  GetAdminPostListQueryDto,
} from './dto/get-admin-post-list-query.dto';
import { UpdateContentPostDto } from './dto/update-content-post.dto';

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
  const contentPostFindFirstMock = jest.fn();
  const contentPostFindManyMock = jest.fn();
  const contentPostCountMock = jest.fn();
  const transactionContentPostFindFirstMock = jest.fn();
  const contentPostUpdateMock = jest.fn();
  const contentPostCategoryDeleteManyMock = jest.fn();
  const contentPostCategoryCreateManyMock = jest.fn();
  const contentImageDeleteManyMock = jest.fn();
  const contentImageCreateManyMock = jest.fn();

  const transactionClientMock = {
    contentPost: {
      create: contentPostCreateMock,
      findFirst: transactionContentPostFindFirstMock,
      update: contentPostUpdateMock,
    },
    file: {
      findMany: fileFindManyMock,
    },
    contentPostCategory: {
      deleteMany: contentPostCategoryDeleteManyMock,
      createMany: contentPostCategoryCreateManyMock,
    },
    contentImage: {
      deleteMany: contentImageDeleteManyMock,
      createMany: contentImageCreateManyMock,
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
    contentPost: {
      findMany: contentPostFindManyMock,
      count: contentPostCountMock,
      findFirst: contentPostFindFirstMock,
    },
  };

  const service = new PostsService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.resetAllMocks();
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

    adminActionLogCreateMock.mockRejectedValueOnce(
      new Error('Audit log failure'),
    );
    await expect(service.createPost(dto, adminId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_CREATE_FAILED',
      },
    });

    expect(contentPostCreateMock).toHaveBeenCalledTimes(1);

    expect(adminActionLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it('should retrieve a published post with categories, ordered images, and author information', async () => {
    const contentImageId1 = '2a85f3d9-f874-4e2c-ae62-762fb311ae84';

    const contentImageId2 = '3b96e4ea-a985-4f3d-bf73-873fc422bf95';

    const eventStartAt = new Date('2026-09-10T10:30:00.000Z');

    const eventEndAt = new Date('2026-09-10T12:00:00.000Z');

    const updatedAt = new Date('2026-08-06T01:30:00.000Z');

    contentPostFindFirstMock.mockResolvedValue({
      id: postId,
      title: 'Members-only Career Talk',
      content: '📌 행사 안내\n• HKUST 동문과 함께하는 커리어 토크입니다.',
      membersOnly: true,
      status: PublicationStatus.PUBLISHED,
      eventStartAt,
      eventEndAt,
      showOnCalendar: true,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt,
      categories: [
        {
          category: ContentPostCategoryType.ALUMNI,
        },
        {
          category: ContentPostCategoryType.CAREER,
        },
        {
          category: ContentPostCategoryType.EVENT,
        },
      ],
      images: [
        {
          id: contentImageId1,
          fileId: fileId1,
          sortOrder: 1,
          file: {
            originalName: 'career-talk-main.jpg',
            fileUrl: 'https://example.com/image-1.jpg',
            contentType: 'image/jpeg',
            fileSize: 1443648,
          },
        },
        {
          id: contentImageId2,
          fileId: fileId2,
          sortOrder: 2,
          file: {
            originalName: 'career-talk-detail.png',
            fileUrl: 'https://example.com/image-2.png',
            contentType: 'image/png',
            fileSize: 900000,
          },
        },
      ],
      author: {
        id: adminId,
        name: 'Sulynn Kim',
      },
    });

    await expect(service.getPostDetail(postId)).resolves.toEqual({
      postId,
      title: 'Members-only Career Talk',
      content: '📌 행사 안내\n• HKUST 동문과 함께하는 커리어 토크입니다.',
      categories: [
        ContentPostCategoryValue.ALUMNI,
        ContentPostCategoryValue.CAREER,
        ContentPostCategoryValue.EVENT,
      ],
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      eventStartAt,
      eventEndAt,
      showOnCalendar: true,
      images: [
        {
          contentImageId: contentImageId1,
          fileId: fileId1,
          originalName: 'career-talk-main.jpg',
          fileUrl: 'https://example.com/image-1.jpg',
          contentType: 'image/jpeg',
          fileSize: 1443648,
          sortOrder: 1,
        },
        {
          contentImageId: contentImageId2,
          fileId: fileId2,
          originalName: 'career-talk-detail.png',
          fileUrl: 'https://example.com/image-2.png',
          contentType: 'image/png',
          fileSize: 900000,
          sortOrder: 2,
        },
      ],
      author: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt,
    });

    expect(contentPostFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: postId,
          deletedAt: null,
        },
      }),
    );

    expect(transactionMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should retrieve a draft post with nullable content and schedule values', async () => {
    const updatedAt = new Date('2026-08-06T01:00:00.000Z');

    contentPostFindFirstMock.mockResolvedValue({
      id: postId,
      title: 'Orientation Day',
      content: null,
      membersOnly: false,
      status: PublicationStatus.DRAFT,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt,
      categories: [
        {
          category: ContentPostCategoryType.EVENT,
        },
      ],
      images: [],
      author: {
        id: adminId,
        name: 'Sulynn Kim',
      },
    });

    await expect(service.getPostDetail(postId)).resolves.toEqual({
      postId,
      title: 'Orientation Day',
      content: null,
      categories: [ContentPostCategoryValue.EVENT],
      membersOnly: false,
      status: CreateContentPostStatus.DRAFT,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
      images: [],
      author: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      publishedAt: null,
      createdAt: fixedNow,
      updatedAt,
    });
  });

  it('should allow an administrator to retrieve a hidden post', async () => {
    const updatedAt = new Date('2026-08-06T02:00:00.000Z');

    contentPostFindFirstMock.mockResolvedValue({
      id: postId,
      title: 'Hidden Announcement',
      content: 'This post is hidden from public screens.',
      membersOnly: false,
      status: PublicationStatus.HIDDEN,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
      publishedAt: fixedNow,
      createdAt: fixedNow,
      updatedAt,
      categories: [
        {
          category: ContentPostCategoryType.ANNOUNCEMENT,
        },
      ],
      images: [],
      author: {
        id: adminId,
        name: 'Sulynn Kim',
      },
    });

    await expect(service.getPostDetail(postId)).resolves.toMatchObject({
      postId,
      status: 'hidden',
      publishedAt: fixedNow,
    });
  });

  it('should reject a missing or soft-deleted post', async () => {
    contentPostFindFirstMock.mockResolvedValue(null);

    await expect(service.getPostDetail(postId)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'C404_CONTENT_POST_NOT_FOUND',
        message: 'Content post not found',
      },
    });

    expect(contentPostFindFirstMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: postId,
          deletedAt: null,
        },
      }),
    );
  });

  it('should return a fetch error when the database query fails', async () => {
    contentPostFindFirstMock.mockRejectedValue(new Error('Database failure'));

    await expect(service.getPostDetail(postId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_FETCH_FAILED',
        message: 'Failed to retrieve the content post',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should retrieve a paginated post list with categories, representative image, and author', async () => {
    const eventStartAt = new Date('2026-09-10T10:30:00.000Z');

    const eventEndAt = new Date('2026-09-10T12:00:00.000Z');

    const updatedAt = new Date('2026-08-06T02:00:00.000Z');

    const posts = [
      {
        id: postId,
        title: 'Orientation Day',
        membersOnly: true,
        status: PublicationStatus.PUBLISHED,
        eventStartAt,
        eventEndAt,
        showOnCalendar: true,
        publishedAt: fixedNow,
        createdAt: fixedNow,
        updatedAt,
        categories: [
          {
            category: ContentPostCategoryType.ANNOUNCEMENT,
          },
          {
            category: ContentPostCategoryType.EVENT,
          },
        ],
        images: [
          {
            fileId: fileId1,
            file: {
              originalName: 'orientation-day.jpg',
              fileUrl: 'https://example.com/orientation-day.jpg',
            },
          },
        ],
        author: {
          id: adminId,
          name: 'Sulynn Kim',
        },
      },
    ];

    contentPostFindManyMock.mockResolvedValue(posts);

    contentPostCountMock.mockResolvedValue(1);

    transactionMock.mockResolvedValueOnce([posts, 1]);

    const query: GetAdminPostListQueryDto = {
      page: 1,
      limit: 10,
      sort: AdminPostSortValue.LATEST,
    };
    await expect(service.getPostList(query)).resolves.toEqual({
      items: [
        {
          postId,
          title: 'Orientation Day',
          categories: [
            ContentPostCategoryValue.ANNOUNCEMENT,
            ContentPostCategoryValue.EVENT,
          ],
          membersOnly: true,
          status: CreateContentPostStatus.PUBLISHED,
          eventStartAt,
          eventEndAt,
          showOnCalendar: true,
          representativeImage: {
            fileId: fileId1,
            originalName: 'orientation-day.jpg',
            fileUrl: 'https://example.com/orientation-day.jpg',
          },
          author: {
            userId: adminId,
            name: 'Sulynn Kim',
          },
          publishedAt: fixedNow,
          createdAt: fixedNow,
          updatedAt,
        },
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      },
    });

    expect(contentPostFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
        },
        skip: 0,
        take: 10,
        orderBy: {
          createdAt: 'desc',
        },
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: {
        deletedAt: null,
      },
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should apply keyword, category, status, pagination, and oldest sorting filters', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(0);

    transactionMock.mockResolvedValueOnce([[], 0]);

    const query: GetAdminPostListQueryDto = {
      keyword: '  Career  ',
      category: ContentPostCategoryValue.EVENT,
      status: AdminContentPostStatusValue.PUBLISHED,
      page: 2,
      limit: 5,
      sort: AdminPostSortValue.OLDEST,
    };

    await expect(service.getPostList(query)).resolves.toEqual({
      items: [],
      pagination: {
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0,
      },
    });

    const expectedWhere = {
      deletedAt: null,
      title: {
        contains: 'Career',
        mode: 'insensitive',
      },
      categories: {
        some: {
          category: ContentPostCategoryType.EVENT,
        },
      },
      status: PublicationStatus.PUBLISHED,
    };

    expect(contentPostFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 5,
        take: 5,
        orderBy: {
          createdAt: 'asc',
        },
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should return null when a post has no representative image', async () => {
    const posts = [
      {
        id: postId,
        title: 'Draft Announcement',
        membersOnly: false,
        status: PublicationStatus.DRAFT,
        eventStartAt: null,
        eventEndAt: null,
        showOnCalendar: false,
        publishedAt: null,
        createdAt: fixedNow,
        updatedAt: fixedNow,
        categories: [
          {
            category: ContentPostCategoryType.ANNOUNCEMENT,
          },
        ],
        images: [],
        author: {
          id: adminId,
          name: 'Sulynn Kim',
        },
      },
    ];

    contentPostFindManyMock.mockResolvedValue(posts);

    contentPostCountMock.mockResolvedValue(1);

    transactionMock.mockResolvedValueOnce([posts, 1]);

    const query: GetAdminPostListQueryDto = {
      page: 1,
      limit: 10,
      sort: AdminPostSortValue.LATEST,
    };

    const result = await service.getPostList(query);

    expect(result.items[0].representativeImage).toBeNull();

    expect(result.items[0]).toMatchObject({
      status: CreateContentPostStatus.DRAFT,
      publishedAt: null,
      eventStartAt: null,
      eventEndAt: null,
    });
  });

  it('should map a hidden post status for the administrator list', async () => {
    const posts = [
      {
        id: postId,
        title: 'Hidden Post',
        membersOnly: false,
        status: PublicationStatus.HIDDEN,
        eventStartAt: null,
        eventEndAt: null,
        showOnCalendar: false,
        publishedAt: fixedNow,
        createdAt: fixedNow,
        updatedAt: fixedNow,
        categories: [
          {
            category: ContentPostCategoryType.ANNOUNCEMENT,
          },
        ],
        images: [],
        author: {
          id: adminId,
          name: 'Sulynn Kim',
        },
      },
    ];

    contentPostFindManyMock.mockResolvedValue(posts);

    contentPostCountMock.mockResolvedValue(1);

    transactionMock.mockResolvedValueOnce([posts, 1]);

    const result = await service.getPostList({
      page: 1,
      limit: 10,
      sort: AdminPostSortValue.LATEST,
    });

    expect(result.items[0].status).toBe('hidden');
  });

  it('should calculate the total number of pages', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(21);

    transactionMock.mockResolvedValueOnce([[], 21]);

    const result = await service.getPostList({
      page: 1,
      limit: 10,
      sort: AdminPostSortValue.LATEST,
    });
    expect(result.pagination.total).toBe(21);
    expect(result.pagination.totalPages).toBe(3);
  });

  it('should return a list fetch error when the database transaction fails', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(0);

    transactionMock.mockRejectedValueOnce(new Error('Database failure'));

    await expect(
      service.getPostList({
        page: 1,
        limit: 10,
        sort: AdminPostSortValue.LATEST,
      }),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_LIST_FETCH_FAILED',
        message: 'Failed to retrieve the content post list',
      },
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject an empty update request', async () => {
    await expect(service.updatePost(postId, {}, adminId)).rejects.toMatchObject(
      {
        status: 400,
        response: {
          errorCode: 'C400_CONTENT_POST_UPDATE_REQUIRED',
          message: 'At least one field must be provided',
        },
      },
    );

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should update only the provided fields', async () => {
    const updatedAt = new Date('2026-08-06T15:00:00.000Z');

    transactionContentPostFindFirstMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.DRAFT,
      publishedAt: null,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
    });

    contentPostUpdateMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.DRAFT,
      publishedAt: null,
      updatedAt,
    });

    const dto: UpdateContentPostDto = {
      title: 'Updated Orientation Day',
    };

    await expect(service.updatePost(postId, dto, adminId)).resolves.toEqual({
      postId,
      status: 'draft',
      publishedAt: null,
      updatedAt,
    });

    expect(contentPostUpdateMock).toHaveBeenCalledWith({
      where: {
        id: postId,
      },
      data: {
        title: 'Updated Orientation Day',
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    });

    expect(contentPostCategoryDeleteManyMock).not.toHaveBeenCalled();

    expect(contentImageDeleteManyMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        action: AdminAction.UPDATE_CONTENT_POST,
        actionType: AdminActionType.CONTENT,
        targetId: postId,
        metadata: {
          updatedFields: ['title'],
          status: PublicationStatus.DRAFT,
        },
      },
    });
  });

  it('should set publishedAt when publishing a post for the first time', async () => {
    transactionContentPostFindFirstMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.DRAFT,
      publishedAt: null,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
    });

    contentPostUpdateMock.mockImplementation(
      ({
        data,
      }: {
        data: {
          publishedAt?: Date;
        };
      }) =>
        Promise.resolve({
          id: postId,
          status: PublicationStatus.PUBLISHED,
          publishedAt: data.publishedAt,
          updatedAt: fixedNow,
        }),
    );

    const result = await service.updatePost(
      postId,
      {
        status: AdminContentPostStatusValue.PUBLISHED,
      },
      adminId,
    );

    expect(result.status).toBe('published');
    expect(result.publishedAt).toBeInstanceOf(Date);

    expect(contentPostUpdateMock).toHaveBeenCalledWith({
      where: {
        id: postId,
      },
      data: {
        status: PublicationStatus.PUBLISHED,
        publishedAt: fixedNow,
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  });

  it('should preserve the original publishedAt after a post has already been published', async () => {
    const originalPublishedAt = new Date('2026-08-01T00:00:00.000Z');

    transactionContentPostFindFirstMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.HIDDEN,
      publishedAt: originalPublishedAt,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
    });

    contentPostUpdateMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.PUBLISHED,
      publishedAt: originalPublishedAt,
      updatedAt: fixedNow,
    });

    await service.updatePost(
      postId,
      {
        status: AdminContentPostStatusValue.PUBLISHED,
      },
      adminId,
    );

    expect(contentPostUpdateMock).toHaveBeenCalledWith({
      where: {
        id: postId,
      },
      data: {
        status: PublicationStatus.PUBLISHED,
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
  });

  it('should replace categories and images when their fields are provided', async () => {
    transactionContentPostFindFirstMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
    });

    fileFindManyMock.mockResolvedValue([
      {
        id: fileId1,
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
      {
        id: fileId2,
        status: FileStatus.COMPLETED,
        purpose: FilePurpose.POST_IMAGE,
        deletedAt: null,
      },
    ]);

    contentPostUpdateMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.PUBLISHED,
      publishedAt: fixedNow,
      updatedAt: fixedNow,
    });

    await service.updatePost(
      postId,
      {
        categories: [
          ContentPostCategoryValue.EVENT,
          ContentPostCategoryValue.ANNOUNCEMENT,
        ],
        imageFileIds: [fileId2, fileId1],
      },
      adminId,
    );

    expect(contentPostCategoryDeleteManyMock).toHaveBeenCalledWith({
      where: {
        contentPostId: postId,
      },
    });

    expect(contentPostCategoryCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          contentPostId: postId,
          category: ContentPostCategoryType.EVENT,
        },
        {
          contentPostId: postId,
          category: ContentPostCategoryType.ANNOUNCEMENT,
        },
      ],
    });

    expect(contentImageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        contentPostId: postId,
      },
    });

    expect(contentImageCreateManyMock).toHaveBeenCalledWith({
      data: [
        {
          contentPostId: postId,
          fileId: fileId2,
          sortOrder: 1,
        },
        {
          contentPostId: postId,
          fileId: fileId1,
          sortOrder: 2,
        },
      ],
    });
  });

  it('should remove all image relationships when an empty image list is provided', async () => {
    transactionContentPostFindFirstMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.DRAFT,
      publishedAt: null,
      eventStartAt: null,
      eventEndAt: null,
      showOnCalendar: false,
    });

    fileFindManyMock.mockResolvedValue([]);

    contentPostUpdateMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.DRAFT,
      publishedAt: null,
      updatedAt: fixedNow,
    });

    await service.updatePost(
      postId,
      {
        imageFileIds: [],
      },
      adminId,
    );

    expect(contentImageDeleteManyMock).toHaveBeenCalledWith({
      where: {
        contentPostId: postId,
      },
    });

    expect(contentImageCreateManyMock).not.toHaveBeenCalled();
  });

  it('should validate the final schedule state using existing and updated values', async () => {
    transactionContentPostFindFirstMock.mockResolvedValue({
      id: postId,
      status: PublicationStatus.DRAFT,
      publishedAt: null,
      eventStartAt: new Date('2026-09-10T10:30:00.000Z'),
      eventEndAt: new Date('2026-09-10T12:00:00.000Z'),
      showOnCalendar: true,
    });

    await expect(
      service.updatePost(
        postId,
        {
          eventStartAt: null,
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'C400_EVENT_START_REQUIRED',
      },
    });

    expect(contentPostUpdateMock).not.toHaveBeenCalled();
  });

  it('should reject a missing or soft-deleted post', async () => {
    transactionContentPostFindFirstMock.mockResolvedValue(null);

    await expect(
      service.updatePost(
        postId,
        {
          title: 'Updated title',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'C404_CONTENT_POST_NOT_FOUND',
        message: 'Content post not found',
      },
    });

    expect(transactionContentPostFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: postId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        publishedAt: true,
        eventStartAt: true,
        eventEndAt: true,
        showOnCalendar: true,
      },
    });
  });

  it('should return an update failure when the transaction fails unexpectedly', async () => {
    transactionMock.mockRejectedValueOnce(new Error('Database failure'));

    await expect(
      service.updatePost(
        postId,
        {
          title: 'Updated title',
        },
        adminId,
      ),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_UPDATE_FAILED',
        message: 'Failed to update the content post',
      },
    });
  });
});
