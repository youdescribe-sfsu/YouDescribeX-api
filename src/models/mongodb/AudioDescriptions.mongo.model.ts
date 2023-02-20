import mongoose, { model, Schema } from 'mongoose';
import { IAudioDescriptions } from '../../interfaces/audioDescriptions.interface';

const AudioDescriptionsSchema = new Schema<IAudioDescriptions>({
  ad_id: {
    type: mongoose.Types.ObjectId,
    required: true,
    unique: true,
    default: mongoose.Types.ObjectId,
  },
  is_published: { type: Boolean, required: true },
});

export const AudioDescriptions = model<IAudioDescriptions>('Audio_Descriptions', AudioDescriptionsSchema);
