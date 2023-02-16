import { IsEmail, IsString } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  public email: string;
  @IsString()
  public name: string;
}

export class CreateUserAudioDescription{
    @IsString()
    public userId: string;
    @IsString()
    public youtubeVideoId : string;
    @IsString()
    public aiUserId: string;
}