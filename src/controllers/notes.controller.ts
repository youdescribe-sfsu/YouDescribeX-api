import { NextFunction, Request, Response } from 'express';
import { NotesAttributes } from '../models/postgres/Notes';
import NotesService from '../services/notes.service';
import { INotes } from '../interfaces/notes.interface';
import { PostNoteByAdIdDto } from '../dtos/notes.dto';

class NotesController {
  public notesService = new NotesService();

  public postNoteByAdId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notesBody: PostNoteByAdIdDto = req.body;
      const videoByYoutubeID: INotes | NotesAttributes | number = await this.notesService.postNoteByAdId(notesBody);
      if (typeof videoByYoutubeID === 'number') {
        res.status(200).json({
          data: `Note with id: ${notesBody.noteId} updated for ad with id: ${notesBody.adId}`,
          affectedRows: videoByYoutubeID,
          message: 'updated',
        });
      } else if (typeof videoByYoutubeID === 'object') {
        res.status(200).json({
          data: `Note with id: ${videoByYoutubeID.notes_id} created for ad with id: ${notesBody.adId}`,
          noteId: videoByYoutubeID.notes_id,
          message: 'created',
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

export default NotesController;
