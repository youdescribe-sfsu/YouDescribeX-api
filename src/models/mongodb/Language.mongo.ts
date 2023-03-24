import mongoose, { Document, Schema } from 'mongoose';

interface ILanguage extends Document {
  code: string;
  language: string;
}

const LanguageSchema = new Schema<ILanguage>(
  {
    code: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
  },
  { collection: 'languages' },
);

const Language = mongoose.model<ILanguage>('Language', LanguageSchema);

export default Language;
