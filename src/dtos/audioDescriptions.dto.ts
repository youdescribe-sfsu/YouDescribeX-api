import { IsString, IsNumberString } from 'class-validator';

interface AudioClips {
  scene_number: number;
  text: string;
  type: string;
  start_time: number;
}

interface Dialog {
  sequence_num: number;
  start_time: number;
  end_time: number;
  duration: number;
}

export class NewAiDescriptionDto {
  public dialog_timestamps: Array<Dialog>;
  public audio_clips: Array<AudioClips>;
  @IsString()
  public aiUserId: string;
  @IsString()
  public youtube_id: string;
  @IsString()
  public video_name: string;
  @IsNumberString()
  public video_length: number;
}
