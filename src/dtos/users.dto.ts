import { IsBoolean, IsEmail, IsString, IsNumber } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  public email: string;
  @IsString()
  public name: string;
  @IsBoolean()
  public isAI: boolean;
}

export class CreateUserAudioDescriptionDto {
  // @IsString()
  // public userId: string;
  @IsString()
  public youtubeVideoId: string;
  // @IsString()
  // public aiUserId: string;
}

export class NewUserDto {
  @IsString()
  public email: string;
  @IsString()
  public name: string;
  @IsString()
  public given_name: string;
  @IsString()
  public picture: string;
  @IsString()
  public locale: string;
  @IsString()
  public google_user_id: string;
  @IsString()
  public token: string;
  @IsBoolean()
  public opt_in: boolean;
  @IsNumber()
  public admin_level: number;
  @IsString()
  public user_type: string;
}
