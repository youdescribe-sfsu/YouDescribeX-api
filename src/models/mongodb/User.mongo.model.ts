import { IUsers } from '../../interfaces/users.interface';
import { model, Schema, Types } from 'mongoose';

const usersSchema = new Schema<IUsers>({
  name: { type: String, required: true },
  user_email: { type: String, required: true },
  is_ai: { type: Boolean, required: true },
  user_id: {
    type: Types.ObjectId,
    required: true,
    unique: true,
    default: Types.ObjectId,
  },
});

export const User = model<IUsers>('Users', usersSchema);
