import { Schema, model, ObjectId } from 'mongoose';

interface INotes {
  notes_text: string;
  notes_timestamp: number;
  audio_description: ObjectId;
}

const NotesSchema = new Schema<INotes>(
  {
    notes_text: { type: String, required: true },
    notes_timestamp: { type: Number, required: true },
    audio_description: { type: Schema.Types.ObjectId, ref: 'AudioDescription', required: true },
  },
  { collection: 'notes' },
);

export default NotesSchema;
export { INotes };
