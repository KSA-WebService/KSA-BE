import 'reflect-metadata';

import {
  GetPublicPostListQueryDto,
  PublicPostPeriodValue,
  PublicPostSortValue,
} from './dto/get-public-post-list-query.dto';
import { PublicPostsController } from './posts.controller';
import { PublicPostsService } from './posts.service';

describe('PublicPostsController', () => {
  const getPostListMock = jest.fn();
  const getPostDetailMock = jest.fn();

  const postsServiceMock = {
    getPostList: getPostListMock,
    getPostDetail: getPostDetailMock,
  };

  const controller = new PublicPostsController(
    postsServiceMock as unknown as PublicPostsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should pass the public post list query to the service', async () => {
    const query: GetPublicPostListQueryDto = {
      period: PublicPostPeriodValue.ALL,
      page: 1,
      size: 10,
      sort: PublicPostSortValue.LATEST,
    };

    const expected = {
      posts: [],
      page: 1,
      size: 10,
      totalCount: 0,
      totalPages: 0,
    };

    getPostListMock.mockResolvedValue(expected);

    await expect(controller.getPostList(query)).resolves.toEqual(expected);

    expect(getPostListMock).toHaveBeenCalledTimes(1);

    expect(getPostListMock).toHaveBeenCalledWith(query);
  });

  it('should pass the post ID to the service when retrieving a public post detail', async () => {
    const postId = '8bc95b8f-cbd1-45ed-b2ef-f80dd06e92db';

    const expected = {
      postId,
      title: 'Orientation Day',
      content: 'HKUST orientation information',
      categories: ['announcement', 'event'],
      membersOnly: false,
      eventStartAt: new Date('2026-09-10T10:30:00.000Z'),
      eventEndAt: new Date('2026-09-10T12:00:00.000Z'),
      images: [],
      publishedAt: new Date('2026-08-06T10:00:00.000Z'),
      updatedAt: new Date('2026-08-07T01:00:00.000Z'),
    };

    getPostDetailMock.mockResolvedValue(expected);

    await expect(controller.getPostDetail(postId)).resolves.toEqual(expected);

    expect(getPostDetailMock).toHaveBeenCalledTimes(1);

    expect(getPostDetailMock).toHaveBeenCalledWith(postId);
  });
});
