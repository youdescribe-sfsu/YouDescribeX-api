import { NextFunction, Request, Response } from 'express';
import { NotesAttributes } from '../models/postgres/Notes';
import NotesService from '../services/notes.service';
import { PostNoteByAdIdDto } from '../dtos/notes.dto';
import { INotes } from '../models/mongodb/Notes.mongo';

class NotesController {
  public notesService = new NotesService();

  public postNoteByAdId = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const notesBody: PostNoteByAdIdDto = req.body;
      const videoByYoutubeID: any = await this.notesService.postNoteByAdId(notesBody);
      if (typeof videoByYoutubeID === 'number') {
        res.status(200).json({
          notes_id: notesBody.noteId,
          ad_id: notesBody.adId,
          message: 'updated',
        });
      } else if (typeof videoByYoutubeID === 'object') {
        res.status(200).json({
          notes_id: notesBody.noteId || videoByYoutubeID.notes_id || videoByYoutubeID._id,
          ad_id: notesBody.adId,
          message: 'posted',
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

export default NotesController;
