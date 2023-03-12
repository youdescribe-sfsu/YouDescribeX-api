import { ObjectId } from 'mongoose';

export interface IUsers {
  user_id: ObjectId | string;
  is_ai: boolean;
  name: string;
  user_email?: string;
  createdAt: Date;
  updatedAt: Date;
}
