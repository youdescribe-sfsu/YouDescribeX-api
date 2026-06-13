import UserService from '../services/users.service';
import { MongoAICaptionRequestModel, MongoUsersModel } from '../models/mongodb/init-models.mongo';

afterAll(async () => {
  await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
});

describe('UserService.computeVideosAhead', () => {
  it('returns 0 when queue is empty and nothing is processing', () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [];
    expect(svc.computeVideosAhead(0)).toBe(0);
  });

  it('returns processing count when this is the first queued item', () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [{ youtubeId: 'a', userId: 'u', aiUserId: 'ai', ydx_app_host: '' }];
    expect(svc.computeVideosAhead(2)).toBe(2);
  });

  it('counts queue items ahead AND currently processing', () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [
      { youtubeId: 'a', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'b', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'c', userId: 'u', aiUserId: 'ai', ydx_app_host: '' },
    ];
    expect(svc.computeVideosAhead(2)).toBe(4);
  });
});

describe('UserService.getNewAudioDescriptionEmailBody', () => {
  it('says "next in line" when videosAhead is 0', () => {
    const svc = new UserService() as any;
    const body: string = svc.getNewAudioDescriptionEmailBody('Alex', 'My Test Video', 0, 0);
    expect(body).toContain('Alex');
    expect(body).toContain('My Test Video');
    expect(body).toMatch(/next in line/i);
    expect(body).not.toMatch(/video\(s\) ahead/i);
  });

  it('includes the videosAhead count when greater than 0', () => {
    const svc = new UserService() as any;
    const body: string = svc.getNewAudioDescriptionEmailBody('Alex', 'My Test Video', 3, 2);
    expect(body).toContain('3 video');
    expect(body).toMatch(/2 being processed/);
  });
});

describe('UserService.processNextInQueueLana — concurrency gate', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('does not dispatch when inFlight >= AI_PIPELINE_CONCURRENCY', async () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [{ youtubeId: 'vid1', userId: 'u', aiUserId: 'ai', ydx_app_host: '' }];

    (MongoAICaptionRequestModel as any).countDocuments = jest.fn().mockResolvedValue(2);
    (MongoAICaptionRequestModel as any).find = jest.fn().mockResolvedValue([]);
    const sendSpy = jest.spyOn(svc, 'sendToApiService').mockResolvedValue(undefined);

    await svc.processNextInQueueLana();

    expect(sendSpy).not.toHaveBeenCalled();
    expect(svc.videoProcessingQueue.length).toBe(1);
  });

  it('dispatches up to AI_PIPELINE_CONCURRENCY items in a single tick when slots are free', async () => {
    const svc = new UserService() as any;
    svc.videoProcessingQueue = [
      { youtubeId: 'vid1', userId: 'u1', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'vid2', userId: 'u2', aiUserId: 'ai', ydx_app_host: '' },
      { youtubeId: 'vid3', userId: 'u3', aiUserId: 'ai', ydx_app_host: '' },
    ];

    (MongoAICaptionRequestModel as any).countDocuments = jest.fn().mockResolvedValue(0);
    (MongoAICaptionRequestModel as any).find = jest.fn().mockResolvedValue([]);
    (MongoAICaptionRequestModel as any).findOne = jest.fn().mockResolvedValue(null);
    (MongoAICaptionRequestModel as any).updateOne = jest.fn().mockResolvedValue({});
    (MongoUsersModel as any).findById = jest.fn().mockResolvedValue({ _id: 'u1', email: 'x@y.z' });

    const sendSpy = jest.spyOn(svc, 'sendToApiService').mockResolvedValue(undefined);

    await svc.processNextInQueueLana();

    // Default AI_PIPELINE_CONCURRENCY is 2 → exactly 2 dispatches, 1 left.
    expect(sendSpy).toHaveBeenCalledTimes(2);
    expect(svc.videoProcessingQueue.length).toBe(1);
    expect(svc.videoProcessingQueue[0].youtubeId).toBe('vid3');
  });
});
