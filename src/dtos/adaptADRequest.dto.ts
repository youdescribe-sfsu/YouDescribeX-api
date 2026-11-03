import { IsOptional, IsString } from 'class-validator';

export class AdaptADRequestDto {
  @IsOptional()
  @IsString()
  public question?: string;
  @IsString()
  public youtubeVideoId: string;
  public timeStamp: string | number;
}
