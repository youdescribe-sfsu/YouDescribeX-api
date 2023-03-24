import mongoose, { Document, Schema } from 'mongoose';

interface IWord extends Document {
  key: string;
  value: string;
}

interface ITranscription extends Document {
  audio_clip: mongoose.Types.ObjectId;
  created_at: Date;
  language: string;
  length: number;
  msg?: string;
  order_id?: string;
  rating?: number;
  status: string;
  updated_at: Date;
  words: IWord[];
}

const WordSchema = new Schema<IWord>({
  key: {
    type: String,
    required: true,
  },
  value: {
    type: String,
    required: true,
  },
});

const TranscriptionSchema = new Schema<ITranscription>(
  {
    audio_clip: {
      type: Schema.Types.ObjectId,
      ref: 'AudioClip',
      required: true,
    },
    created_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    language: {
      type: String,
      required: true,
    },
    length: {
      type: Number,
      required: true,
    },
    msg: {
      type: String,
    },
    order_id: {
      type: String,
    },
    rating: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['failed', 'successful'],
      required: true,
    },
    updated_at: {
      type: Date,
      required: true,
      default: Date.now,
    },
    words: {
      type: [WordSchema],
      required: true,
    },
  },
  { collection: 'transcriptions' },
);

const Transcription = mongoose.model<ITranscription>('Transcription', TranscriptionSchema);

export default Transcription;
