import { Module } from '@nestjs/common';

import { PublicPostsController } from './posts.controller';
import { PublicPostsService } from './posts.service';

@Module({
  controllers: [PublicPostsController],
  providers: [PublicPostsService],
})
export class PublicPostsModule {}
