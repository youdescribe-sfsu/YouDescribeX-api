import { ObjectId } from 'mongoose';

export interface IUsers {
  user_id: ObjectId;
  is_ai: boolean;
  name: string;
  user_email: string;
}