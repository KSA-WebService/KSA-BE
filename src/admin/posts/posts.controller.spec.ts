import 'reflect-metadata';

import {
  ContentPostCategoryValue,
  CreateContentPostDto,
  CreateContentPostStatus,
} from './dto/create-content-post.dto';
import {
  AdminPostSortValue,
  GetAdminPostListQueryDto,
} from './dto/get-admin-post-list-query.dto';
import { UpdateContentPostDto } from './dto/update-content-post.dto';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';

describe('PostsController', () => {
  const postId = '8bc95b8f-cbd1-45ed-b2ef-f80dd06e92db';

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const fixedNow = new Date('2026-08-06T15:00:00.000Z');

  const createPostMock = jest.fn();
  const updatePostMock = jest.fn();
  const getPostListMock = jest.fn();
  const getPostDetailMock = jest.fn();

  const postsServiceMock = {
    createPost: createPostMock,
    updatePost: updatePostMock,
    getPostList: getPostListMock,
    getPostDetail: getPostDetailMock,
  };

  const controller = new PostsController(
    postsServiceMock as unknown as PostsService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass the post DTO and administrator ID to the service', async () => {
    const dto: CreateContentPostDto = {
      title: 'Members-only Career Talk',
      content: '📌 Career talk details\n• Venue: HKUST',
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
      imageFileIds: ['421c9cce-db39-471f-a49a-5da4d28f74c0'],
    };

    const expected = {
      postId,
      title: dto.title,
      categories: dto.categories,
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      eventStartAt: new Date('2026-09-10T10:30:00.000Z'),
      eventEndAt: new Date('2026-09-10T12:00:00.000Z'),
      showOnCalendar: true,
      images: [
        {
          fileId: '421c9cce-db39-471f-a49a-5da4d28f74c0',
          fileUrl:
            'https://example.supabase.co/storage/v1/object/public/public-images/post-image.png',
          sortOrder: 1,
        },
      ],
      publishedAt: new Date('2026-08-06T00:00:00.000Z'),
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    };

    createPostMock.mockResolvedValue(expected);

    const request = {
      user: {
        id: adminId,
      },
    };

    await expect(controller.createPost(dto, request)).resolves.toEqual(
      expected,
    );

    expect(createPostMock).toHaveBeenCalledTimes(1);

    expect(createPostMock).toHaveBeenCalledWith(dto, adminId);
  });

  it('should pass a draft post without optional fields to the service', async () => {
    const dto: CreateContentPostDto = {
      title: 'Orientation Day',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
    };

    const expected = {
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
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
    };

    createPostMock.mockResolvedValue(expected);

    const request = {
      user: {
        id: adminId,
      },
    };

    await expect(controller.createPost(dto, request)).resolves.toEqual(
      expected,
    );

    expect(createPostMock).toHaveBeenCalledWith(dto, adminId);
  });

  it('should pass the post ID to the detail service', async () => {
    const expected = {
      postId,
      title: 'Members-only Career Talk',
      content: '📌 행사 안내\n• HKUST 동문과 함께하는 커리어 토크입니다.',
      categories: [
        ContentPostCategoryValue.CAREER,
        ContentPostCategoryValue.EVENT,
        ContentPostCategoryValue.ALUMNI,
      ],
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      eventStartAt: new Date('2026-09-10T10:30:00.000Z'),
      eventEndAt: new Date('2026-09-10T12:00:00.000Z'),
      showOnCalendar: true,
      images: [],
      author: {
        userId: adminId,
        name: 'Sulynn Kim',
      },
      publishedAt: new Date('2026-08-06T00:00:00.000Z'),
      createdAt: new Date('2026-08-06T00:00:00.000Z'),
      updatedAt: new Date('2026-08-06T01:00:00.000Z'),
    };

    getPostDetailMock.mockResolvedValue(expected);

    await expect(controller.getPostDetail(postId)).resolves.toEqual(expected);

    expect(getPostDetailMock).toHaveBeenCalledTimes(1);

    expect(getPostDetailMock).toHaveBeenCalledWith(postId);
  });

  it('should pass the list query to the service', async () => {
    const query: GetAdminPostListQueryDto = {
      keyword: 'Orientation',
      page: 1,
      limit: 10,
      sort: AdminPostSortValue.LATEST,
    };

    const expected = {
      items: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    };

    getPostListMock.mockResolvedValue(expected);

    await expect(controller.getPostList(query)).resolves.toEqual(expected);

    expect(getPostListMock).toHaveBeenCalledTimes(1);

    expect(getPostListMock).toHaveBeenCalledWith(query);
  });

  it('should pass the post ID, update DTO, and administrator ID to the service', async () => {
    const dto: UpdateContentPostDto = {
      title: 'Updated Orientation Day',
    };

    const request = {
      user: {
        id: adminId,
      },
    };

    const expected = {
      postId,
      status: 'draft',
      publishedAt: null,
      updatedAt: fixedNow,
    };

    updatePostMock.mockResolvedValue(expected);

    await expect(controller.updatePost(postId, dto, request)).resolves.toEqual(
      expected,
    );

    expect(updatePostMock).toHaveBeenCalledTimes(1);

    expect(updatePostMock).toHaveBeenCalledWith(postId, dto, adminId);
  });
});
