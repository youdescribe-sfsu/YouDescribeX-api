import { AddTotalTimeDto } from '../dtos/timings.dto';
import { CURRENT_DATABASE } from '../config';
import { HttpException } from '../exceptions/HttpException';
import { PostGres_Timings, Timings } from '../models/postgres/init-models';
import { isEmpty } from '../utils/util';
class TimingsService {
  public async addTotalTime(timingBody: AddTotalTimeDto): Promise<Timings> {
    const { participant_id, time, video_id } = timingBody;
    if (isEmpty(participant_id)) throw new HttpException(400, 'Participant ID is empty');
    if (isEmpty(video_id)) throw new HttpException(400, 'Video ID is empty');

    if (CURRENT_DATABASE == 'mongodb') {
    } else {
      // Create a new note
      const addTotalTime = await PostGres_Timings.create({
        ParticipantParticipantId: participant_id,
        youtube_video_id: video_id,
        total_time: time,
      });
      if (!addTotalTime) throw new HttpException(409, 'Unable To add total time');
      return addTotalTime;
    }
  }
}

export default TimingsService;
