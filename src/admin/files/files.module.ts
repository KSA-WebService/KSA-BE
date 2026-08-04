import { Module } from '@nestjs/common';
import { SupabaseAdminService } from '../../auth/supabase-admin.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  controllers: [FilesController],
  providers: [FilesService, SupabaseAdminService],
})
export class FilesModule {}
