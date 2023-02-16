import { model, Types, Schema } from 'mongoose';
import { INotes } from '../../interfaces/notes.interface';



const NotesSchema = new Schema<INotes>({
    notes_id: { type: Types.ObjectId, default: Types.ObjectId, required: true, unique: true },
    notes_text: { type: String, required: true },
  });

export const Notes = model<INotes>('Notes', NotesSchema);

// const Notes_Schema = mongoDb.Schema({
//     notes_id: {
//         type: mongoose.Types.ObjectId,
//         default: mongoose.Types.ObjectId,
//         required: [true],
//         unique: true,
//     },
//     notes_text: {
//         type: String,
//         required: [true],
//     }
// });
// const Notes_Mongo = mongoDb.model('Notes', Notes_Schema);

// module.exports = Notes_Mongo;


