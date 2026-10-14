// xiao1009 Unit tests for RefineAD's service. Nothing here touches MongoDB or OpenAI: the model
// statics are spied on and llm.util is mocked, following the approach of users.queue.test.ts:8-30
// (construct the service directly, cast to any, stub what it reaches for).
import { LlmError, callLlmChat } from '../utils/llm.util';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoDialog_Timestamps_Model, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import RefineService, { MIN_WORD_BUDGET, SPEECH_WORDS_PER_SECOND } from '../services/refine.service';

// xiao1009 Only callLlmChat is replaced; LlmError stays real so the timeout test can throw the same
// class the util would throw in production.
jest.mock('../utils/llm.util', () => {
  const actual = jest.requireActual('../utils/llm.util');
  return { ...actual, callLlmChat: jest.fn() };
});

const mockedCallLlmChat = callLlmChat as jest.MockedFunction<typeof callLlmChat>;

// xiao1009 Valid 24-hex ids, because the service rejects anything Types.ObjectId.isValid() refuses
// before it reaches the database.
const AD_ID = '650506db3ff1c2140ea10ec1';
const CLIP_ID = '650506db3ff1c2140ea10ec2';
const PREV_CLIP_ID = '650506db3ff1c2140ea10ec3';
const NEXT_CLIP_ID = '650506db3ff1c2140ea10ec4';
const USER_ID = '650506db3ff1c2140ea10ec5';
const OTHER_USER_ID = '650506db3ff1c2140ea10ec6';
const VIDEO_ID = '650506db3ff1c2140ea10ec7';

interface StubClip {
  _id: string;
  description_text?: string;
  description_type?: string;
  start_time: number;
  end_time?: number;
  duration?: number;
  transcript?: { sentence: string }[];
}

const makeClip = (id: string, startTime: number, text: string, duration = 3): StubClip => ({
  _id: id,
  description_text: text,
  description_type: 'Visual',
  start_time: startTime,
  end_time: startTime + duration,
  duration,
});

// xiao1009 One helper per collection the service reads, so each test says only what it cares about.
const stubAudioDescription = (doc: unknown) => jest.spyOn(MongoAudio_Descriptions_Model as any, 'findById').mockReturnValue({ exec: async () => doc } as any);

const stubClips = (clips: unknown[]) =>
  jest.spyOn(MongoAudioClipsModel as any, 'find').mockReturnValue({
    sort: () => ({ exec: async () => clips }),
  } as any);

const stubVideo = (doc: unknown) => jest.spyOn(MongoVideosModel as any, 'findById').mockReturnValue({ exec: async () => doc } as any);

const stubNextDialog = (doc: unknown) =>
  jest.spyOn(MongoDialog_Timestamps_Model as any, 'findOne').mockReturnValue({
    sort: () => ({ exec: async () => doc }),
  } as any);

const ownedAudioDescription = { _id: AD_ID, user: USER_ID, video: VIDEO_ID };

// xiao1009 The default world every test starts from: an owned description with three clips, the
// middle one being the one under test, a 60 second video and no dialogue anywhere.
const stubHappyWorld = () => {
  stubAudioDescription(ownedAudioDescription);
  stubClips([
    makeClip(PREV_CLIP_ID, 5, 'A woman kneels beside a row of terracotta pots.'),
    makeClip(CLIP_ID, 10, 'She very carefully tips the plant out of its really small plastic pot.'),
    makeClip(NEXT_CLIP_ID, 14.5, 'She presses fresh compost around the roots.'),
  ]);
  stubVideo({ _id: VIDEO_ID, title: 'How to repot a houseplant', duration: 60 });
  stubNextDialog(null);
};

const baseInput = {
  audioDescriptionId: AD_ID,
  userId: USER_ID,
  clipId: CLIP_ID,
  currentText: 'She very carefully tips the plant out of its really small plastic pot.',
};

afterAll(async () => {
  await new Promise<void>(resolve => setTimeout(() => resolve(), 200));
});

afterEach(() => {
  jest.restoreAllMocks();
  mockedCallLlmChat.mockReset();
});

beforeEach(() => {
  mockedCallLlmChat.mockResolvedValue({ text: 'She tips the plant out of its pot.', model: 'gpt-4o-mini', responseId: 'chatcmpl-test' });
});

describe('RefineService.computeWordBudget', () => {
  it('converts seconds at the pipeline speech rate', () => {
    const service = new RefineService() as any;
    expect(service.computeWordBudget(10)).toBe(10 * SPEECH_WORDS_PER_SECOND);
    expect(service.computeWordBudget(4.2)).toBe(13);
  });

  it('never drops below the floor, however tight the gap', () => {
    const service = new RefineService() as any;
    expect(service.computeWordBudget(0.5)).toBe(MIN_WORD_BUDGET);
    expect(service.computeWordBudget(0)).toBe(MIN_WORD_BUDGET);
  });
});

describe('RefineService.buildClipContext', () => {
  it('returns both neighbours, the video title and a budget from the next clip', async () => {
    stubHappyWorld();
    const service = new RefineService();

    const context = await service.buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.clipId).toBe(CLIP_ID);
    expect(context.previousText).toBe('A woman kneels beside a row of terracotta pots.');
    expect(context.nextText).toBe('She presses fresh compost around the roots.');
    expect(context.videoTitle).toBe('How to repot a houseplant');
    // next clip starts at 14.5, this one at 10
    expect(context.availableSeconds).toBeCloseTo(4.5);
    expect(context.wordBudget).toBe(14);
  });

  it('leaves previousText undefined for the first clip', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([makeClip(CLIP_ID, 0, 'First description.'), makeClip(NEXT_CLIP_ID, 6, 'Second description.')]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);

    const context = await new RefineService().buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.previousText).toBeUndefined();
    expect(context.nextText).toBe('Second description.');
  });

  it('falls back to the end of the video for the last clip', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([makeClip(PREV_CLIP_ID, 5, 'Earlier description.'), makeClip(CLIP_ID, 50, 'Last description.')]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);

    const context = await new RefineService().buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.nextText).toBeUndefined();
    expect(context.availableSeconds).toBeCloseTo(10);
  });

  it('prefers the next line of dialogue when it starts before the next clip', async () => {
    stubHappyWorld();
    stubNextDialog({ dialog_start_time: 12 });

    const context = await new RefineService().buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.availableSeconds).toBeCloseTo(2);
    expect(context.wordBudget).toBe(6);
  });

  it('falls back to the clip duration when a boundary sits before the clip starts', async () => {
    stubAudioDescription(ownedAudioDescription);
    // overlapping clips are legal in this data, so the "next" clip can start earlier
    stubClips([makeClip(CLIP_ID, 10, 'Target description.', 7), makeClip(NEXT_CLIP_ID, 8, 'Overlapping description.')]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);

    const context = await new RefineService().buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.availableSeconds).toBe(7);
  });

  it('omits the budget entirely when neither a boundary nor a duration is known', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([{ _id: CLIP_ID, description_text: 'Only clip.', description_type: 'Visual', start_time: 10, duration: 0 }]);
    stubVideo(null);
    stubNextDialog(null);

    const context = await new RefineService().buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.availableSeconds).toBeUndefined();
    expect(context.wordBudget).toBeUndefined();
    expect(context.videoTitle).toBeUndefined();
  });

  it('reads a recorded neighbour from its transcript', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([
      { _id: PREV_CLIP_ID, description_text: '', start_time: 5, duration: 3, transcript: [{ sentence: 'Spoken part one.' }, { sentence: 'Spoken part two.' }] },
      makeClip(CLIP_ID, 10, 'Target description.'),
    ]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);

    const context = await new RefineService().buildClipContext(ownedAudioDescription as any, CLIP_ID);

    expect(context.previousText).toBe('Spoken part one. Spoken part two.');
  });

  it('rejects a clip that is not in this description with 404', async () => {
    stubHappyWorld();

    await expect(new RefineService().buildClipContext(ownedAudioDescription as any, '650506db3ff1c2140ea10e99')).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('RefineService.getSuggestion — request validation', () => {
  it('rejects an unknown presetId with 400 and never calls the model', async () => {
    stubHappyWorld();

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'make-it-pop' })).rejects.toMatchObject({ status: 400 });
    expect(mockedCallLlmChat).not.toHaveBeenCalled();
  });

  it('names the valid preset ids in the 400 message', async () => {
    stubHappyWorld();

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'make-it-pop' })).rejects.toThrow(/shorten-to-fit/);
  });

  it('rejects a request with neither a preset nor an instruction', async () => {
    stubHappyWorld();

    await expect(new RefineService().getSuggestion({ ...baseInput })).rejects.toMatchObject({ status: 400 });
    expect(mockedCallLlmChat).not.toHaveBeenCalled();
  });

  it('rejects a blank instruction', async () => {
    stubHappyWorld();

    await expect(new RefineService().getSuggestion({ ...baseInput, instruction: '   ' })).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a malformed audioDescriptionId with 400 rather than letting Mongoose cast it', async () => {
    stubHappyWorld();

    await expect(new RefineService().getSuggestion({ ...baseInput, audioDescriptionId: 'not-an-id', presetId: 'simplify' })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('RefineService.getSuggestion — ownership', () => {
  it('rejects a description owned by someone else, as a 403-mapped AuthorizationError', async () => {
    stubAudioDescription({ _id: AD_ID, user: OTHER_USER_ID, video: VIDEO_ID });
    stubClips([]);
    stubVideo(null);
    stubNextDialog(null);

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({
      name: 'AuthorizationError',
    });
    expect(mockedCallLlmChat).not.toHaveBeenCalled();
  });

  it('rejects a description that does not exist with 404', async () => {
    stubAudioDescription(null);

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('RefineService.getSuggestion — prompt assembly', () => {
  const sentUserPrompt = () => mockedCallLlmChat.mock.calls[0][0].userPrompt;

  it('sends the preset instruction, both neighbours, the title and the time budget', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'shorten-to-fit' });

    const prompt = sentUserPrompt();
    expect(prompt).toContain('VIDEO TITLE: "How to repot a houseplant"');
    expect(prompt).toContain('PREVIOUS DESCRIPTION');
    expect(prompt).toContain('NEXT DESCRIPTION');
    expect(prompt).toContain('AVAILABLE TIME: 4.50 seconds');
    expect(prompt).toContain('aim for about 14 words');
    expect(prompt).toContain('fits the available narration time');
  });

  it('withholds the time budget from a preset that does not use one', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'fix-grammar' });

    expect(sentUserPrompt()).not.toContain('AVAILABLE TIME');
  });

  it('labels a free-text request as the task when no preset was chosen', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, instruction: 'make it sound less robotic' });

    const prompt = sentUserPrompt();
    expect(prompt).toContain("TASK, in the describer's own words: make it sound less robotic");
    expect(prompt).not.toContain('ADDITIONAL REQUEST');
  });

  it('keeps both sections when a preset and a free-text request are sent together', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'fix-grammar', instruction: 'british spelling please' });

    const prompt = sentUserPrompt();
    expect(prompt).toContain('TASK: Correct only grammar');
    expect(prompt).toContain('ADDITIONAL REQUEST FROM THE DESCRIBER: british spelling please');
  });

  it('rewrites the text from the edit box, not the text in the database', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({
      ...baseInput,
      currentText: 'UNSAVED EDITOR TEXT',
      presetId: 'simplify',
    });

    expect(sentUserPrompt()).toContain('UNSAVED EDITOR TEXT');
    expect(sentUserPrompt()).not.toContain('She very carefully tips');
    expect(response.suggestions[0].original).toBe('UNSAVED EDITOR TEXT');
  });
});

describe('RefineService.getSuggestion — response', () => {
  it('returns one suggestion with the model, a requestId and the word budget', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({ ...baseInput, presetId: 'shorten-to-fit' });

    expect(response.model).toBe('gpt-4o-mini');
    expect(response.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.suggestions).toHaveLength(1);
    expect(response.suggestions[0]).toMatchObject({
      clipId: CLIP_ID,
      original: baseInput.currentText,
      suggestion: 'She tips the plant out of its pot.',
      wordBudget: 14,
    });
  });

  it('omits wordBudget for a preset that does not use one', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({ ...baseInput, presetId: 'fix-grammar' });

    expect(response.suggestions[0].wordBudget).toBeUndefined();
  });

  it('gives every request its own requestId', async () => {
    stubHappyWorld();
    const service = new RefineService();

    const first = await service.getSuggestion({ ...baseInput, presetId: 'simplify' });
    const second = await service.getSuggestion({ ...baseInput, presetId: 'simplify' });

    expect(first.requestId).not.toBe(second.requestId);
  });
});

describe('RefineService.getSuggestion — cleaning what the model returns', () => {
  const expectCleaned = async (modelReply: string, expected: string) => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: modelReply, model: 'gpt-4o-mini', responseId: 'r' });

    const response = await new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' });

    expect(response.suggestions[0].suggestion).toBe(expected);
  };

  it('strips a code fence', async () => {
    await expectCleaned('```\nShe tips the plant out.\n```', 'She tips the plant out.');
  });

  it('strips a fence that carries a language tag', async () => {
    await expectCleaned('```text\nShe tips the plant out.\n```', 'She tips the plant out.');
  });

  it('strips a leading label', async () => {
    await expectCleaned('Rewritten description: She tips the plant out.', 'She tips the plant out.');
  });

  it('strips one layer of surrounding quotes', async () => {
    await expectCleaned('"She tips the plant out."', 'She tips the plant out.');
  });

  it('keeps quotes that belong to the sentence', async () => {
    await expectCleaned('A title card reads "SPRING" in white letters.', 'A title card reads "SPRING" in white letters.');
  });
});

describe('RefineService.getSuggestion — failures', () => {
  it('lets a timeout through as a 503', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockRejectedValue(new LlmError('timeout', 503, 'AI service timed out, please try again'));

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({
      status: 503,
      kind: 'timeout',
    });
  });

  it('lets an upstream failure through as a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockRejectedValue(new LlmError('upstream', 502, 'AI service request failed'));

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({ status: 502 });
  });

  it('turns an empty reply into a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: '   ', model: 'gpt-4o-mini', responseId: 'r' });

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({ status: 502 });
  });

  it('turns a reply that is only a label into a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: 'Suggestion:', model: 'gpt-4o-mini', responseId: 'r' });

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({ status: 502 });
  });

  it('turns a rambling reply into a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: 'x'.repeat(5000), model: 'gpt-4o-mini', responseId: 'r' });

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'simplify' })).rejects.toMatchObject({ status: 502 });
  });
});

// xiao1009 The hard guarantee from the brief: generating a suggestion must not write anything and must
// not synthesise audio. If someone later adds a write to this service, this test fails.
describe('RefineService.getSuggestion — read-only guarantee', () => {
  it('writes nothing to the database', async () => {
    stubHappyWorld();

    const writeSpies = [
      jest.spyOn(MongoAudioClipsModel as any, 'create'),
      jest.spyOn(MongoAudioClipsModel as any, 'findByIdAndUpdate'),
      jest.spyOn(MongoAudioClipsModel as any, 'updateOne'),
      jest.spyOn(MongoAudioClipsModel as any, 'deleteOne'),
      jest.spyOn(MongoAudio_Descriptions_Model as any, 'create'),
      jest.spyOn(MongoAudio_Descriptions_Model as any, 'findByIdAndUpdate'),
      jest.spyOn(MongoAudio_Descriptions_Model as any, 'updateOne'),
    ];

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'shorten-to-fit' });

    writeSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });
});
