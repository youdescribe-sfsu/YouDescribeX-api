import { IsString, IsObject, IsOptional } from 'class-validator';

export class DownloadCallbackDto {
  @IsString()
  public youtube_id: string;

  @IsOptional()
  @IsString()
  public user_id?: string;

  @IsOptional()
  @IsString()
  public ai_user_id?: string;

  @IsObject()
  public s3_paths: {
    video?: string;
    metadata?: string;
    thumbnail?: string;
  };

  @IsString()
  public s3_bucket: string;

  @IsString()
  public status: string;
}
