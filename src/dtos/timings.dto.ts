import { IsString } from 'class-validator';

export class AddTotalTimeDto {
  @IsString()
  public participant_id: string;
  @IsString()
  public time: number;
  @IsString()
  public video_id: string;
}
