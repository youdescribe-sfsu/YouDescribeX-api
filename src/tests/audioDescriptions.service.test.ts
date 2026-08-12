import AudioDescriptionsService from '../services/audioDescriptions.service';
import { MongoAudio_Descriptions_Model } from '../models/mongodb/init-models.mongo';

jest.mock('../services/gpu_utils.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../models/mongodb/init-models.mongo', () => ({
  MongoAudio_Descriptions_Model: {
    aggregate: jest.fn(),
  },
}));

describe('AudioDescriptionsService.getAllAIDescriptions', () => {
  const aggregateMock = MongoAudio_Descriptions_Model.aggregate as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns public AI drafts with their audio description IDs', async () => {
    const execMock = jest.fn().mockResolvedValue([
      {
        videos: [
          {
            audio_description_id: 'audio-description-123',
            youtube_id: 'youtube-123',
            video_name: 'Test video',
            status: 'draft',
            admin_review: false,
          },
        ],
        total: 1,
      },
    ]);

    aggregateMock.mockReturnValue({
      exec: execMock,
    });

    const service = new AudioDescriptionsService();
    const result = await service.getAllAIDescriptions('1');

    expect(result).toEqual({
      result: [
        {
          audio_description_id: 'audio-description-123',
          youtube_id: 'youtube-123',
          video_name: 'Test video',
          status: 'draft',
          admin_review: false,
        },
      ],
      totalVideos: 1,
    });

    expect(aggregateMock).toHaveBeenCalledTimes(1);

    const pipeline = aggregateMock.mock.calls[0][0];

    expect(pipeline).toEqual(
      expect.arrayContaining([
        {
          $match: {
            status: 'draft',
            admin_review: false,
          },
        },
        {
          $match: {
            'userData.user_type': 'AI',
          },
        },
      ]),
    );

    expect(pipeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          $project: expect.objectContaining({
            audio_description_id: '$_id',
            youtube_id: '$videoData.youtube_id',
          }),
        }),
      ]),
    );
  });
});
