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

  const postsServiceMock = {
    getPostList: getPostListMock,
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
});
