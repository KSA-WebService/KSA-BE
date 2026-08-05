import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CreateImageUploadUrlDto } from './dto/create-image-upload-url.dto';
import { FilesService } from './files.service';
import { CompleteFileUploadDto } from './dto/complete-file-upload.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin/files')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presigned-url')
  async createImageUploadUrl(
    @Body() dto: CreateImageUploadUrlDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.filesService.createImageUploadUrl(dto, request.user.id);
  }

  @Post('complete')
  async completeFileUpload(
    @Body() dto: CompleteFileUploadDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.filesService.completeFileUpload(dto.fileId, request.user.id);
  }

  @Delete(':fileId')
  async deleteFile(
    @Param(
      'fileId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    fileId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.filesService.deleteFile(fileId, request.user.id);
  }
}
