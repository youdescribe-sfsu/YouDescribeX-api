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
  @IsString()
  public newACStartTime: string;
  @IsString()
  public newACTitle: string;
  @IsString()
  public newACType: string;
  @IsString()
  public newACDescriptionText: string;
  @IsString()
  public recordedClipDuration: string;
  @IsString()
  public isRecorded: boolean;
  @IsString()
  public newACPlaybackType: string;
  @IsString()
  public newACDuration: string;
  @IsString()
  public userId: string;
  @IsString()
  public youtubeVideoId: string;
}
