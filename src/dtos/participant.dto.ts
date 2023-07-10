import { IsString } from 'class-validator';

export class AddNewParticipantDto {
  @IsString()
  public name: string;
  @IsString()
  public email: string;
  @IsString()
  public youtubeVideoIdWithAi: string;
  @IsString()
  public youtubeVideoIdWithoutAi: string;
  @IsString()
  public userIdWithAi: string;
  @IsString()
  public userIdWithoutAi: string;
}
