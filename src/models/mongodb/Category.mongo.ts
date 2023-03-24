import mongoose, { Document, Schema } from 'mongoose';

interface ICategory extends Document {
  category_id: number;
  category: string;
}

const CategorySchema = new Schema<ICategory>(
  {
    category_id: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
  },
  { collection: 'categories' },
);

const Category = mongoose.model<ICategory>('Category', CategorySchema);

export default Category;
