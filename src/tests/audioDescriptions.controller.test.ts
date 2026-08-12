import { NextFunction, Request, Response } from 'express';
import AudioDescriptionsController from '../controllers/audioDescriptions.controller';
import AudioDescriptionsService from '../services/audioDescriptions.service';

jest.mock('../services/audioDescriptions.service');

jest.mock('../services/gpu_utils.service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../utils/emailService', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('AudioDescriptionsController.getAllAIDescriptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows an unauthenticated request to retrieve AI drafts', async () => {
    const controller = new AudioDescriptionsController();

    const getAllAIDescriptionsMock = jest.spyOn(controller.audioDescriptionsService, 'getAllAIDescriptions').mockResolvedValue({
      result: [
        {
          audio_description_id: 'audio-description-123',
          youtube_id: 'youtube-123',
        },
      ],
      totalVideos: 1,
    });

    const req = {
      query: {
        pageNumber: '2',
      },
    } as unknown as Request;

    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });

    const res = {
      status,
    } as unknown as Response;

    const next = jest.fn() as NextFunction;

    await controller.getAllAIDescriptions(req, res, next);

    expect(getAllAIDescriptionsMock).toHaveBeenCalledWith('2');
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      result: [
        {
          audio_description_id: 'audio-description-123',
          youtube_id: 'youtube-123',
        },
      ],
      totalVideos: 1,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
