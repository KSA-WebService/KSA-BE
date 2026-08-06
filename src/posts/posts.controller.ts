import { Controller, Get, Query } from '@nestjs/common';

import { GetPublicPostListQueryDto } from './dto/get-public-post-list-query.dto';
import { PublicPostsService } from './posts.service';

@Controller('posts')
export class PublicPostsController {
  constructor(private readonly postsService: PublicPostsService) {}

  @Get()
  async getPostList(
    @Query()
    query: GetPublicPostListQueryDto,
  ) {
    return this.postsService.getPostList(query);
  }
}
