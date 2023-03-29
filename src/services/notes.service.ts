import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { NotesAttributes, PostGres_Notes } from '../models/postgres/init-models';
import { PostNoteByAdIdDto } from '../dtos/notes.dto';
import { logger } from '../utils/logger';
import { MongoNotesModel } from '../models/mongodb/init-models.mongo';
import { INotes } from '../models/mongodb/Notes.mongo';
class NotesService {
  public async postNoteByAdId(notesBody: PostNoteByAdIdDto): Promise<INotes | NotesAttributes | number> {
    const { adId, noteId, notes } = notesBody;
    if (isEmpty(adId)) throw new HttpException(400, 'Audio Description ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      if (isEmpty(noteId)) {
        const newNote = await MongoNotesModel.create({
          notes_text: notes,
          audio_description: adId,
        });
        return newNote;
      } else {
        logger.info(`noteId, ${noteId}`);
        const audioDescriptionID = await MongoNotesModel.findOne({
          where: { audio_description: adId },
        });
        if (!audioDescriptionID) throw new HttpException(409, "Audio Description doesn't exist");

        const updatedNotes = await MongoNotesModel.update(
          { notes_text: notes },
          {
            where: {
              audio_description: adId,
            },
            returning: true, // returns the updated row
          },
        );
        if (!updatedNotes) throw new HttpException(409, 'Notes not updated');
        return updatedNotes.modifiedCount;
      }
    } else {
      // Create a new note
      if (isEmpty(noteId)) {
        const newNote = await PostGres_Notes.create({
          notes_text: notes,
          AudioDescriptionAdId: adId,
        });
        return newNote;
      } else {
        logger.info(`noteId, ${noteId}`);
        const audioDescriptionID = await PostGres_Notes.findOne({
          where: { AudioDescriptionAdId: adId },
        });
        if (!audioDescriptionID) throw new HttpException(409, "Audio Description doesn't exist");

        const updatedNotes = await PostGres_Notes.update(
          { notes_text: notes },
          {
            where: {
              AudioDescriptionAdId: adId,
            },
            returning: true, // returns the updated row
          },
        );
        if (!updatedNotes) throw new HttpException(409, 'Notes not updated');
        return updatedNotes.length;
      }
    }
  }
}

export default NotesService;
