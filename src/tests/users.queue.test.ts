import UserService from '../services/users.service';

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
