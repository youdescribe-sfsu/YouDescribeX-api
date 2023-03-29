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

export default LanguageSchema;
export { ILanguage };
