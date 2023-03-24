import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  username: string;
  password: string;
  level: number;
}

const adminSchema: Schema = new Schema(
  {
    username: String,
    password: String,
    level: Number,
  },
  { collection: 'admins' },
);

const Admin = mongoose.model<IAdmin>('Admin', adminSchema);

export default Admin;
