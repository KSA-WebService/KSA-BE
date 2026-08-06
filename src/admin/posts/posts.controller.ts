import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { CreateContentPostDto } from './dto/create-content-post.dto';
import { PostsService } from './posts.service';
import { GetAdminPostListQueryDto } from './dto/get-admin-post-list-query.dto';

type AuthenticatedAdminRequest = {
  user: {
    id: string;
  };
};

@Controller('admin/posts')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @Body() dto: CreateContentPostDto,
    @Req() request: AuthenticatedAdminRequest,
  ) {
    return this.postsService.createPost(dto, request.user.id);
  }

  @Get()
  async getPostList(@Query() query: GetAdminPostListQueryDto) {
    return this.postsService.getPostList(query);
  }

  @Get(':postId')
  async getPostDetail(
    @Param('postId', new ParseUUIDPipe({ version: '4' }))
    postId: string,
  ) {
    return this.postsService.getPostDetail(postId);
  }
}
