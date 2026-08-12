import 'reflect-metadata';

import { ContentPostCategoryType, PublicationStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  GetPublicPostListQueryDto,
  PublicContentPostCategoryValue,
  PublicPostPeriodValue,
  PublicPostSortValue,
} from './dto/get-public-post-list-query.dto';
import { PublicPostsService } from './posts.service';

describe('PublicPostsService', () => {
  const fixedNow = new Date('2026-08-07T00:00:00.000Z');

  const postId = '8bc95b8f-cbd1-45ed-b2ef-f80dd06e92db';

  const fileId = '421c9cce-db39-471f-a49a-5da4d28f74c0';

  const contentPostFindManyMock = jest.fn();
  const contentPostCountMock = jest.fn();
  const contentPostFindFirstMock = jest.fn();
  const transactionMock = jest.fn();

  const prismaMock = {
    $transaction: transactionMock,
    contentPost: {
      findMany: contentPostFindManyMock,
      count: contentPostCountMock,
      findFirst: contentPostFindFirstMock,
    },
  };

  const service = new PublicPostsService(
    prismaMock as unknown as PrismaService,
  );

  const expectedPublicPostDetailSelect = {
    id: true,
    title: true,
    content: true,
    membersOnly: true,
    eventStartAt: true,
    eventEndAt: true,
    publishedAt: true,
    updatedAt: true,
    categories: {
      orderBy: {
        category: 'asc',
      },
      select: {
        category: true,
      },
    },
    images: {
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        fileId: true,
        sortOrder: true,
        file: {
          select: {
            fileUrl: true,
          },
        },
      },
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should retrieve published and non-deleted posts with a representative image', async () => {
    const publishedAt = new Date('2026-08-06T10:00:00.000Z');

    const eventStartAt = new Date('2026-09-10T10:30:00.000Z');

    const eventEndAt = new Date('2026-09-10T12:00:00.000Z');

    const posts = [
      {
        id: postId,
        title: 'Orientation Day',
        membersOnly: false,
        eventStartAt,
        eventEndAt,
        publishedAt,
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
            fileId,
            file: {
              fileUrl: 'https://example.com/orientation.jpg',
            },
          },
        ],
      },
    ];

    contentPostFindManyMock.mockResolvedValue(posts);

    contentPostCountMock.mockResolvedValue(1);

    transactionMock.mockResolvedValueOnce([posts, 1]);

    const query: GetPublicPostListQueryDto = {
      period: PublicPostPeriodValue.ALL,
      page: 1,
      limit: 10,
      sort: PublicPostSortValue.LATEST,
    };

    await expect(service.getPostList(query)).resolves.toEqual({
      items: [
        {
          postId,
          title: 'Orientation Day',
          categories: [
            PublicContentPostCategoryValue.ANNOUNCEMENT,
            PublicContentPostCategoryValue.EVENT,
          ],
          membersOnly: false,
          eventStartAt,
          eventEndAt,
          representativeImage: {
            fileId,
            fileUrl: 'https://example.com/orientation.jpg',
          },
          publishedAt,
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
          status: PublicationStatus.PUBLISHED,
          deletedAt: null,
        },
        skip: 0,
        take: 10,
        orderBy: [
          {
            publishedAt: 'desc',
          },
          {
            createdAt: 'desc',
          },
          {
            id: 'desc',
          },
        ],
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: {
        status: PublicationStatus.PUBLISHED,
        deletedAt: null,
      },
    });
  });

  it('should return null when a post has no representative image', async () => {
    const posts = [
      {
        id: postId,
        title: 'Public Announcement',
        membersOnly: true,
        eventStartAt: null,
        eventEndAt: null,
        publishedAt: fixedNow,
        categories: [
          {
            category: ContentPostCategoryType.ANNOUNCEMENT,
          },
        ],
        images: [],
      },
    ];

    contentPostFindManyMock.mockResolvedValue(posts);

    contentPostCountMock.mockResolvedValue(1);

    transactionMock.mockResolvedValueOnce([posts, 1]);

    const result = await service.getPostList({
      period: PublicPostPeriodValue.ALL,
      page: 1,
      limit: 10,
      sort: PublicPostSortValue.LATEST,
    });

    expect(result.items[0].representativeImage).toBeNull();

    expect(result.items[0]).toMatchObject({
      membersOnly: true,
      eventStartAt: null,
      eventEndAt: null,
    });
  });

  it('should apply keyword, category, pagination, and oldest sorting', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(0);

    transactionMock.mockResolvedValueOnce([[], 0]);

    const query: GetPublicPostListQueryDto = {
      keyword: '  Career  ',
      category: PublicContentPostCategoryValue.EVENT,
      period: PublicPostPeriodValue.ALL,
      page: 2,
      limit: 5,
      sort: PublicPostSortValue.OLDEST,
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
      status: PublicationStatus.PUBLISHED,
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
    };

    expect(contentPostFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
        skip: 5,
        take: 5,
        orderBy: [
          {
            publishedAt: 'asc',
          },
          {
            createdAt: 'asc',
          },
          {
            id: 'asc',
          },
        ],
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should apply the upcoming period filter', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(0);

    transactionMock.mockResolvedValueOnce([[], 0]);

    await service.getPostList({
      period: PublicPostPeriodValue.UPCOMING,
      page: 1,
      limit: 10,
      sort: PublicPostSortValue.LATEST,
    });

    const expectedWhere = {
      status: PublicationStatus.PUBLISHED,
      deletedAt: null,
      eventStartAt: {
        not: null,
      },
      OR: [
        {
          eventEndAt: {
            gte: fixedNow,
          },
        },
        {
          eventEndAt: null,
          eventStartAt: {
            gte: fixedNow,
          },
        },
      ],
    };

    expect(contentPostFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should apply the past period filter', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(0);

    transactionMock.mockResolvedValueOnce([[], 0]);

    await service.getPostList({
      period: PublicPostPeriodValue.PAST,
      page: 1,
      limit: 10,
      sort: PublicPostSortValue.LATEST,
    });

    const expectedWhere = {
      status: PublicationStatus.PUBLISHED,
      deletedAt: null,
      eventStartAt: {
        not: null,
      },
      OR: [
        {
          eventEndAt: {
            lt: fixedNow,
          },
        },
        {
          eventEndAt: null,
          eventStartAt: {
            lt: fixedNow,
          },
        },
      ],
    };

    expect(contentPostFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should apply the undated period filter', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(0);

    transactionMock.mockResolvedValueOnce([[], 0]);

    await service.getPostList({
      period: PublicPostPeriodValue.UNDATED,
      page: 1,
      limit: 10,
      sort: PublicPostSortValue.LATEST,
    });

    const expectedWhere = {
      status: PublicationStatus.PUBLISHED,
      deletedAt: null,
      eventStartAt: null,
    };

    expect(contentPostFindManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expectedWhere,
      }),
    );

    expect(contentPostCountMock).toHaveBeenCalledWith({
      where: expectedWhere,
    });
  });

  it('should calculate the total number of pages', async () => {
    contentPostFindManyMock.mockResolvedValue([]);

    contentPostCountMock.mockResolvedValue(21);

    transactionMock.mockResolvedValueOnce([[], 21]);

    const result = await service.getPostList({
      period: PublicPostPeriodValue.ALL,
      page: 1,
      limit: 10,
      sort: PublicPostSortValue.LATEST,
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
        period: PublicPostPeriodValue.ALL,
        page: 1,
        limit: 10,
        sort: PublicPostSortValue.LATEST,
      }),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_LIST_FETCH_FAILED',
        message: 'Failed to retrieve the content post list',
      },
    });
  });

  it('should retrieve a published post with categories and ordered images', async () => {
    const eventStartAt = new Date('2026-09-10T10:30:00.000Z');

    const eventEndAt = new Date('2026-09-10T12:00:00.000Z');

    const publishedAt = new Date('2026-08-06T10:00:00.000Z');

    const updatedAt = new Date('2026-08-07T01:00:00.000Z');

    const fileId1 = '421c9cce-db39-471f-a49a-5da4d28f74c0';

    const fileId2 = '9f3a2b1c-3333-4d22-8e20-def987654321';

    contentPostFindFirstMock.mockResolvedValue({
      id: postId,
      title: 'Orientation Day',
      content: 'HKUST orientation information',
      membersOnly: false,
      eventStartAt,
      eventEndAt,
      publishedAt,
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
          sortOrder: 1,
          file: {
            fileUrl: 'https://example.com/orientation-1.jpg',
          },
        },
        {
          fileId: fileId2,
          sortOrder: 2,
          file: {
            fileUrl: 'https://example.com/orientation-2.jpg',
          },
        },
      ],
    });

    await expect(service.getPostDetail(postId)).resolves.toEqual({
      postId,
      title: 'Orientation Day',
      content: 'HKUST orientation information',
      categories: [
        PublicContentPostCategoryValue.ANNOUNCEMENT,
        PublicContentPostCategoryValue.EVENT,
      ],
      membersOnly: false,
      eventStartAt,
      eventEndAt,
      images: [
        {
          fileId: fileId1,
          fileUrl: 'https://example.com/orientation-1.jpg',
          sortOrder: 1,
        },
        {
          fileId: fileId2,
          fileUrl: 'https://example.com/orientation-2.jpg',
          sortOrder: 2,
        },
      ],
      publishedAt,
      updatedAt,
    });

    expect(contentPostFindFirstMock).toHaveBeenCalledTimes(1);

    expect(contentPostFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: postId,
        status: PublicationStatus.PUBLISHED,
        deletedAt: null,
      },
      select: expectedPublicPostDetailSelect,
    });
  });

  it('should return nullable content and schedule values with an empty image list', async () => {
    const publishedAt = new Date('2026-08-06T10:00:00.000Z');

    const updatedAt = new Date('2026-08-07T01:00:00.000Z');

    contentPostFindFirstMock.mockResolvedValue({
      id: postId,
      title: 'General Announcement',
      content: null,
      membersOnly: true,
      eventStartAt: null,
      eventEndAt: null,
      publishedAt,
      updatedAt,
      categories: [
        {
          category: ContentPostCategoryType.ANNOUNCEMENT,
        },
      ],
      images: [],
    });

    await expect(service.getPostDetail(postId)).resolves.toEqual({
      postId,
      title: 'General Announcement',
      content: null,
      categories: [PublicContentPostCategoryValue.ANNOUNCEMENT],
      membersOnly: true,
      eventStartAt: null,
      eventEndAt: null,
      images: [],
      publishedAt,
      updatedAt,
    });
  });

  it('should reject a post that is not publicly accessible', async () => {
    contentPostFindFirstMock.mockResolvedValue(null);

    await expect(service.getPostDetail(postId)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'C404_CONTENT_POST_NOT_FOUND',
        message: 'Content post not found',
      },
    });

    expect(contentPostFindFirstMock).toHaveBeenCalledWith({
      where: {
        id: postId,
        status: PublicationStatus.PUBLISHED,
        deletedAt: null,
      },
      select: expectedPublicPostDetailSelect,
    });
  });

  it('should return a fetch error when the detail database query fails', async () => {
    contentPostFindFirstMock.mockRejectedValueOnce(
      new Error('Database failure'),
    );

    await expect(service.getPostDetail(postId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'C500_CONTENT_POST_FETCH_FAILED',
        message: 'Failed to retrieve the content post',
      },
    });
  });
});
