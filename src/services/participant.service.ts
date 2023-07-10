import { CURRENT_DATABASE } from '../config';
import { HttpException } from '../exceptions/HttpException';
import { Participants, PostGres_Participants } from '../models/postgres/init-models';
import { isEmpty } from '../utils/util';
import { AddNewParticipantDto } from '../dtos/participant.dto';
import { MongoParticipantsModel } from '../models/mongodb/init-models.mongo';
import { ParticipantsAttributes } from '../models/mongodb/Participants.mongo';

class ParticipantService {
  public async addNewParticipant(newParticpantData: AddNewParticipantDto): Promise<Participants | ParticipantsAttributes> {
    const { email, name, userIdWithAi, userIdWithoutAi, youtubeVideoIdWithAi, youtubeVideoIdWithoutAi } = newParticpantData;

    if (isEmpty(email)) throw new HttpException(400, 'Email is empty');
    if (isEmpty(name)) throw new HttpException(400, 'Name is empty');
    if (isEmpty(userIdWithAi)) throw new HttpException(400, 'userIdWithAi is empty');
    if (isEmpty(userIdWithoutAi)) throw new HttpException(400, 'userIdWithoutAi is empty');
    if (isEmpty(youtubeVideoIdWithAi)) throw new HttpException(400, 'youtubeVideoIdWithAi is empty');
    if (isEmpty(youtubeVideoIdWithoutAi)) throw new HttpException(400, 'youtubeVideoIdWithoutAi is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const participantResponse = await MongoParticipantsModel.create({
        participant_email: email,
        participant_name: name,
        user_id_with_AI: userIdWithAi,
        user_id_without_AI: userIdWithoutAi,
        youtube_video_id_with_AI: youtubeVideoIdWithAi,
        youtube_video_id_without_AI: youtubeVideoIdWithoutAi,
      });
      if (!participantResponse) throw new HttpException(409, 'Unable To create new participant');
      return participantResponse;
    } else {
      const participantResponse = await PostGres_Participants.create({
        participant_email: email,
        participant_name: name,
        user_id_with_AI: userIdWithAi,
        user_id_without_AI: userIdWithoutAi,
        youtube_video_id_with_AI: youtubeVideoIdWithAi,
        youtube_video_id_without_AI: youtubeVideoIdWithoutAi,
      });
      if (!participantResponse) throw new HttpException(409, 'Unable To create new participant');
      return participantResponse;
    }
  }

  public async getParticipantById(participantId: string): Promise<Participants | ParticipantsAttributes> {
    if (isEmpty(participantId)) throw new HttpException(400, 'ParticipantId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const participantResponse = await MongoParticipantsModel.findById(participantId);
      if (!participantResponse) throw new HttpException(409, `Cannot find participant with id=${participantId}`);
      return participantResponse;
    } else {
      const participantResponse = await PostGres_Participants.findByPk(participantId);
      if (!participantResponse) throw new HttpException(409, `Cannot find participant with id=${participantId}`);
      return participantResponse;
    }
  }
}

export default ParticipantService;
