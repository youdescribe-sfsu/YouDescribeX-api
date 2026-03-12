import { IsString } from 'class-validator';

export class VideoQueryRequestDto {
  @IsString()
  public question: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public timeStamp: string;
}
