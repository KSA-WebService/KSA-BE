import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { CreateContentPostDto } from './dto/create-content-post.dto';
import { PostsService } from './posts.service';

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
}
