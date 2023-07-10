import mongoose, { Schema, Document } from 'mongoose';

export interface IAdmin extends Document {
  username: string;
  password: string;
  level: number;
}

const AdminSchema: Schema = new Schema(
  {
    username: String,
    password: String,
    level: Number,
  },
  { collection: 'admins' },
);

export default AdminSchema;
