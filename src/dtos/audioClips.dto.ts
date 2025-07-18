import { IsString } from 'class-validator';

export class UpdateAudioClipStartTimeDto {
  @IsString()
  public clipStartTime: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public audioDescriptionId: string;
}

export class UpdateAudioClipDescriptionDto {
  @IsString()
  public userId: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public clipDescriptionText: string;
  @IsString()
  public clipDescriptionType: string;
  @IsString()
  public audioDescriptionId: string;
}

export class UpdateClipAudioPathDto {
  @IsString()
  public clipStartTime: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public clipDescriptionText: string;
  @IsString()
  public recordedClipDuration: string;
  @IsString()
  public audioDescriptionId: string;
}

export class AddNewAudioClipDto {
  isRecorded: string;
  newACDescriptionText: string;
  newACPlaybackType: string;
  newACStartTime: string;
  newACTitle: string;
  newACType: string;
  newACDuration: string | null;
  userId: string;
  youtubeVideoId: string;
}
