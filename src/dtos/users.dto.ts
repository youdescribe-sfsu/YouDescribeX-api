import { IsBoolean, IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  public email: string;
  @IsString()
  public name: string;
  @IsBoolean()
  public isAI: boolean;
}

export class CreateUserAudioDescriptionDto {
  @IsString()
  public userId: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public aiUserId: string;
}
