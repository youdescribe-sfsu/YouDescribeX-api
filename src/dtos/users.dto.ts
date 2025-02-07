import { IsBoolean, IsEmail, IsString, IsNumber, ValidateIf, IsOptional } from 'class-validator';

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
  @IsString()
  public aiUserId?: string;
}

export class NewUserDto {
  @IsString()
  public email: string;
  @IsOptional()
  @IsString()
  public name: string;
  @IsString()
  public given_name: string;
  @IsString()
  public picture: string;
  @IsString()
  public locale: string;
  // @IsOptional()
  @IsString()
  public google_user_id?: string;
  // @IsOptional()
  @IsString()
  public apple_user_id?: string;
  @IsString()
  public token: string;
  @IsBoolean()
  public opt_in: boolean;
  @IsNumber()
  public admin_level: number;
  @IsString()
  public user_type: string;
}

export class AudioDescGenerationRequestDTO {
  @IsString()
  public userId: string;
  @IsString()
  public youtubeVideoId: string;
  @IsString()
  public aiUserId: string;
  @IsString()
  @ValidateIf(o => o.ydx_app_host === undefined)
  public ydx_app_host: string | undefined;
}
