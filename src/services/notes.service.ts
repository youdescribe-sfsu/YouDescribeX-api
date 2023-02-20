import { HttpException } from '../exceptions/HttpException';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { NotesAttributes, PostGres_Notes } from '../models/postgres/init-models';
import { INotes } from '../interfaces/notes.interface';
class NotesService {
  public async postNoteByAdId(notesBody: { notes_text: string; adId: string; noteId: string }): Promise<INotes | NotesAttributes | number> {
    const { adId, noteId, notes_text } = notesBody;
    if (isEmpty(adId)) throw new HttpException(400, 'Audio Description ID is empty');
    if (isEmpty(notes_text)) throw new HttpException(400, 'Notes Text is empty');

    if (CURRENT_DATABASE == 'mongodb') {
    } else {
      // Create a new note
      if (isEmpty(noteId)) {
        const newNote = await PostGres_Notes.create({
          notes_text: notes_text,
          AudioDescriptionAdId: adId,
        });
        return newNote;
      } else {
        console.log('noteId', noteId);
        const audioDescriptionID = await PostGres_Notes.findOne({
          where: { AudioDescriptionAdId: adId },
        });
        if (!audioDescriptionID) throw new HttpException(409, "Audio Description doesn't exist");

        const updatedNotes = await PostGres_Notes.update(
          { notes_text: notes_text },
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
