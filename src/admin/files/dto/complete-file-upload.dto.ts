import { IsUUID } from 'class-validator';

export class CompleteFileUploadDto {
  @IsUUID('4')
  fileId!: string;
}
