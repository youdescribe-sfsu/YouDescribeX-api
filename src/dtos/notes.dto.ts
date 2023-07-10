import { IsString } from 'class-validator';

export class PostNoteByAdIdDto {
  @IsString()
  public notes: string;
  @IsString()
  public adId: string;
  @IsString()
  public noteId: string;
}
