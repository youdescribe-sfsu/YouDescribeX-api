import { IsString } from 'class-validator';

export class InfoBotRequestDto {
  @IsString()
  public question: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public timeStamp: string;
}
