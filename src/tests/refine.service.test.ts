// xiao1009 Unit tests for RefineAD's service. Nothing here touches MongoDB or OpenAI: the model
// statics are spied on and llm.util is mocked, following the approach of users.queue.test.ts:8-30
// (construct the service directly, cast to any, stub what it reaches for).
import { LlmError, callLlmChat } from '../utils/llm.util';
import { MongoAudioClipsModel, MongoAudio_Descriptions_Model, MongoDialog_Timestamps_Model, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import RefineService, { MIN_LENGTH_LIMIT, MIN_WORD_BUDGET, RULES_ONLY_MODEL, SPEECH_WORDS_PER_SECOND } from '../services/refine.service';
import { CONCISE_LENGTH_RATIO, REFINE_PRESETS } from '../prompts/refinePresets';
import { REFINE_SYSTEM_PROMPT } from '../prompts/refine.prompt';

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
  playback_type?: 'inline' | 'extended';
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

// Leijie Fix timing reads every dialogue line of the video with find(), not findOne().
const stubDialogs = (docs: { dialog_start_time: number; dialog_end_time: number }[]) =>
  jest.spyOn(MongoDialog_Timestamps_Model as any, 'find').mockReturnValue({ exec: async () => docs } as any);

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
  stubVideo({ _id: VIDEO_ID, title: 'How to repot a houseplant', category: 'Howto & Style', duration: 60 });
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

// Leijie The length limit every preset gets in Phase 1: round(original words × ratio), floored.
describe('RefineService.computeLengthLimit', () => {
  it('scales the word count of the original by the ratio', () => {
    const service = new RefineService() as any;
    // baseInput.currentText has 13 words
    expect(service.computeLengthLimit(baseInput.currentText, CONCISE_LENGTH_RATIO)).toBe(9);
    expect(service.computeLengthLimit('  one   two three  ', 1.2)).toBe(4);
  });

  it('never drops below the floor', () => {
    const service = new RefineService() as any;
    expect(service.computeLengthLimit('Hi', 0.3)).toBe(MIN_LENGTH_LIMIT);
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
    expect(context.videoGenre).toBe('Howto & Style');
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

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'make-it-pop' })).rejects.toThrow(/make-concise/);
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

    await expect(new RefineService().getSuggestion({ ...baseInput, audioDescriptionId: 'not-an-id', presetId: 'polish' })).rejects.toMatchObject({
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

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({
      name: 'AuthorizationError',
    });
    expect(mockedCallLlmChat).not.toHaveBeenCalled();
  });

  it('rejects a description that does not exist with 404', async () => {
    stubAudioDescription(null);

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('RefineService.getSuggestion — prompt assembly', () => {
  const sentUserPrompt = () => mockedCallLlmChat.mock.calls[0][0].userPrompt;

  it('sends the preset instruction, both neighbours, the title, the genre and the length limit', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'make-concise' });

    const prompt = sentUserPrompt();
    expect(prompt).toContain('VIDEO TITLE: "How to repot a houseplant"');
    expect(prompt).toContain('VIDEO GENRE: "Howto & Style"');
    expect(prompt).toContain('PREVIOUS DESCRIPTION');
    expect(prompt).toContain('NEXT DESCRIPTION');
    expect(prompt).toContain('LENGTH LIMIT: 9 words or fewer.');
    expect(prompt).toContain('TASK: Make this description concise.');
  });

  it('never sends the time budget in Phase 1', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'make-concise' });

    expect(sentUserPrompt()).not.toContain('AVAILABLE TIME');
  });

  it('gives each preset its own length limit from its ratio', async () => {
    stubHappyWorld();
    const service = new RefineService();

    await service.getSuggestion({ ...baseInput, presetId: 'polish' });
    await service.getSuggestion({ ...baseInput, presetId: 'style-action-focus' });

    // Polish: max(13 × 1.15, 13 + 5); Style: 13 × 1.2
    expect(mockedCallLlmChat.mock.calls[0][0].userPrompt).toContain('LENGTH LIMIT: 18 words or fewer.');
    expect(mockedCallLlmChat.mock.calls[1][0].userPrompt).toContain('LENGTH LIMIT: 16 words or fewer.');
  });

  it('sends no length limit for a free-text request', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, instruction: 'make it sound less robotic' });

    expect(sentUserPrompt()).not.toContain('LENGTH LIMIT');
  });

  it('passes the preset temperature through, and leaves the default for presets without one', async () => {
    stubHappyWorld();
    const service = new RefineService();

    await service.getSuggestion({ ...baseInput, presetId: 'polish' });
    await service.getSuggestion({ ...baseInput, presetId: 'make-concise' });

    expect(mockedCallLlmChat.mock.calls[0][0].temperature).toBe(0.2);
    expect(mockedCallLlmChat.mock.calls[1][0].temperature).toBeUndefined();
  });

  it("rejects Add details without the describer's details, before calling the model", async () => {
    stubHappyWorld();

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'add-details' })).rejects.toMatchObject({ status: 400 });
    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'add-details', instruction: '  ' })).rejects.toMatchObject({ status: 400 });
    expect(mockedCallLlmChat).not.toHaveBeenCalled();
  });

  it('sends the details as the additional request and counts them in the length limit', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'add-details', instruction: 'the pot is terracotta' });

    const prompt = sentUserPrompt();
    expect(prompt).toContain('TASK: Add the details given in the ADDITIONAL REQUEST');
    expect(prompt).toContain('ADDITIONAL REQUEST FROM THE DESCRIBER: the pot is terracotta');
    // 13 original words + 4 detail words
    expect(prompt).toContain('LENGTH LIMIT: 17 words or fewer.');
  });

  it('builds every Style option from the shared shell', () => {
    const styles = REFINE_PRESETS.filter(preset => preset.id.startsWith('style-'));

    expect(styles.map(preset => preset.id)).toEqual(['style-character-focus', 'style-action-focus', 'style-environment-focus', 'style-simple-language']);
    styles.forEach(preset => {
      expect(preset.instruction).toContain('This is a style change.');
      expect(preset.instruction).toContain('Never exceed the length limit.');
    });
  });

  // Leijie Core constraints 4 and 7.
  it('treats ALL-CAPS runs as on-screen text and keeps Text on Screen descriptions word for word', () => {
    expect(REFINE_SYSTEM_PROMPT).toContain('Two or more consecutive words in ALL CAPITALS');
    expect(REFINE_SYSTEM_PROMPT).toContain('If the DESCRIPTION TYPE is "Text on Screen"');
    expect(REFINE_SYSTEM_PROMPT).toContain('VIDEO GENRE, DESCRIPTION TYPE, PREVIOUS DESCRIPTION');
  });

  it('sends the clip description type', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' });

    expect(mockedCallLlmChat.mock.calls[0][0].userPrompt).toContain('DESCRIPTION TYPE: "Visual"');
  });

  it('keeps the 13 principles as the lowest layer under the new core constraints', () => {
    expect(REFINE_SYSTEM_PROMPT.indexOf('LAYER 1 - CORE CONSTRAINTS')).toBeLessThan(REFINE_SYSTEM_PROMPT.indexOf('LAYER 4 - WRITE FOR THE EAR'));
    expect(REFINE_SYSTEM_PROMPT.indexOf('LAYER 4 - WRITE FOR THE EAR')).toBeLessThan(REFINE_SYSTEM_PROMPT.indexOf('LAYER 5 - AUDIO DESCRIPTION PRINCIPLES'));
    expect(REFINE_SYSTEM_PROMPT).toContain('Do not give away surprises');
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

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'polish', instruction: 'british spelling please' });

    const prompt = sentUserPrompt();
    expect(prompt).toContain('TASK: Polish this description');
    expect(prompt).toContain('ADDITIONAL REQUEST FROM THE DESCRIBER: british spelling please');
  });

  it('rewrites the text from the edit box, not the text in the database', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({
      ...baseInput,
      currentText: 'UNSAVED EDITOR TEXT',
      presetId: 'polish',
    });

    expect(sentUserPrompt()).toContain('UNSAVED EDITOR TEXT');
    expect(sentUserPrompt()).not.toContain('She very carefully tips');
    expect(response.suggestions[0].original).toBe('UNSAVED EDITOR TEXT');
  });
});

describe('RefineService.getSuggestion — response', () => {
  it('returns one suggestion with the model and a requestId', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({ ...baseInput, presetId: 'make-concise' });

    expect(response.model).toBe('gpt-4o-mini');
    expect(response.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.suggestions).toHaveLength(1);
    expect(response.suggestions[0]).toMatchObject({
      clipId: CLIP_ID,
      original: baseInput.currentText,
      suggestion: 'She tips the plant out of its pot.',
      unchanged: false,
    });
    expect(response.suggestions[0]).not.toHaveProperty('wordBudget');
  });

  it('marks an unchanged reply as valid rather than failing it', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: baseInput.currentText, model: 'gpt-4o-mini', responseId: 'r' });

    const response = await new RefineService().getSuggestion({ ...baseInput, presetId: 'make-concise' });

    expect(response.suggestions[0]).toMatchObject({ suggestion: baseInput.currentText, unchanged: true });
  });

  // Leijie STYLE_MIN_WORDS: a description too short to restyle never reaches the model.
  it('answers a too-short description unchanged for a Style option, without calling the model', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({
      ...baseInput,
      currentText: 'Colette uncovers the baked ratatouille.',
      presetId: 'style-character-focus',
    });

    expect(mockedCallLlmChat).not.toHaveBeenCalled();
    expect(response.model).toBe(RULES_ONLY_MODEL);
    expect(response.suggestions[0]).toMatchObject({ suggestion: 'Colette uncovers the baked ratatouille.', unchanged: true });
    expect(response.suggestions[0].reason).toMatch(/too short/);
  });

  it('still calls the model for a short description when the preset is not a Style option', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, currentText: 'Colette uncovers the baked ratatouille.', presetId: 'polish' });

    expect(mockedCallLlmChat).toHaveBeenCalledTimes(1);
  });

  // Leijie CONCISE_MIN_WORDS: a description of 4 words or fewer has nothing left to cut.
  it('answers a description under 5 words unchanged for Make concise, without calling the model', async () => {
    stubHappyWorld();

    const response = await new RefineService().getSuggestion({ ...baseInput, currentText: 'Spider rests; bat hangs.', presetId: 'make-concise' });

    expect(mockedCallLlmChat).not.toHaveBeenCalled();
    expect(response.suggestions[0]).toMatchObject({ unchanged: true, reason: 'This description is already concise.' });
  });

  it('still calls the model for Make concise at exactly 5 words', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, currentText: 'Orange-shirted man addresses camera, jungle today.', presetId: 'make-concise' });

    expect(mockedCallLlmChat).toHaveBeenCalledTimes(1);
  });

  // Leijie POLISH_MIN_EXTRA_WORDS: a fragment gets room to become a full sentence.
  it('gives Polish at least five extra words for a short fragment', async () => {
    stubHappyWorld();

    await new RefineService().getSuggestion({ ...baseInput, currentText: 'Two track snow; one walks dunes.', presetId: 'polish' });

    // 6 words: max(6 × 1.15 = 7, 6 + 5 = 11)
    expect(mockedCallLlmChat.mock.calls[0][0].userPrompt).toContain('LENGTH LIMIT: 11 words or fewer.');
  });

  it('gives every request its own requestId', async () => {
    stubHappyWorld();
    const service = new RefineService();

    const first = await service.getSuggestion({ ...baseInput, presetId: 'polish' });
    const second = await service.getSuggestion({ ...baseInput, presetId: 'polish' });

    expect(first.requestId).not.toBe(second.requestId);
  });
});

describe('RefineService.getSuggestion — cleaning what the model returns', () => {
  const expectCleaned = async (modelReply: string, expected: string) => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: modelReply, model: 'gpt-4o-mini', responseId: 'r' });

    const response = await new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' });

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

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({
      status: 503,
      kind: 'timeout',
    });
  });

  it('lets an upstream failure through as a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockRejectedValue(new LlmError('upstream', 502, 'AI service request failed'));

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({ status: 502 });
  });

  it('turns an empty reply into a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: '   ', model: 'gpt-4o-mini', responseId: 'r' });

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({ status: 502 });
  });

  it('turns a reply that is only a label into a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: 'Suggestion:', model: 'gpt-4o-mini', responseId: 'r' });

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({ status: 502 });
  });

  it('turns a rambling reply into a 502', async () => {
    stubHappyWorld();
    mockedCallLlmChat.mockResolvedValue({ text: 'x'.repeat(5000), model: 'gpt-4o-mini', responseId: 'r' });

    await expect(new RefineService().getSuggestion({ ...baseInput, presetId: 'polish' })).rejects.toMatchObject({ status: 502 });
  });
});

describe('RefineService.getSuggestion — Fix timing', () => {
  const fixTiming = (overrides: Record<string, unknown> = {}) => new RefineService().getSuggestion({ ...baseInput, presetId: 'fix-timing', ...overrides });

  it('answers from the rules alone when the saved clip already fits', async () => {
    stubHappyWorld();
    stubDialogs([]);

    const response = await fixTiming();

    expect(mockedCallLlmChat).not.toHaveBeenCalled();
    expect(response.model).toBe('none');
    // saved text, so the TTS duration (3 s) is used; the next clip starts 4.5 s later
    expect(response.suggestions[0]).toMatchObject({
      suggestion: baseInput.currentText,
      unchanged: true,
      timing: { estimatedSeconds: 3, availableSeconds: 4.5 },
    });
    expect(response.suggestions[0].timingChange).toBeUndefined();
    expect(response.suggestions[0].reason).toMatch(/already fits/);
  });

  it('suggests inline for an extended clip that fits', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([{ ...makeClip(CLIP_ID, 10, baseInput.currentText), playback_type: 'extended' }, makeClip(NEXT_CLIP_ID, 14.5, 'Next.')]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);
    stubDialogs([]);

    const response = await fixTiming();

    expect(response.suggestions[0].timingChange).toEqual({ track: 'inline' });
  });

  it('shortens unsaved text to the word budget, estimating its length from the words', async () => {
    stubHappyWorld();
    stubDialogs([{ dialog_start_time: 12, dialog_end_time: 13 }]);
    mockedCallLlmChat.mockResolvedValue({ text: 'She tips the plant out.', model: 'gpt-4o-mini', responseId: 'r' });

    // 8 unsaved words -> 2.67 s; 2 s gap -> 6 words, and 6 >= 8 x 0.6
    const response = await fixTiming({ currentText: 'She carefully tips the plant out of it.' });

    const prompt = mockedCallLlmChat.mock.calls[0][0].userPrompt;
    expect(prompt).toContain('AVAILABLE TIME: 2.00 seconds');
    expect(prompt).toContain('LENGTH LIMIT: 6 words or fewer.');
    expect(prompt).toContain('TASK: Shorten this description');
    expect(response.suggestions[0]).toMatchObject({ suggestion: 'She tips the plant out.', unchanged: false, timing: { availableSeconds: 2 } });
    expect(response.suggestions[0].reason).toMatch(/Shortened to 6 words/);
  });

  it('never shortens a Text on Screen description, and says why', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([{ ...makeClip(CLIP_ID, 10, 'ENTER CODE BEAST FORTY NOW TODAY PLEASE'), description_type: 'Text on Screen' }]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);
    // 8 unsaved words -> 2.67 s; 2 s gap would allow shortening to 6 words for a Visual clip
    stubDialogs([{ dialog_start_time: 12, dialog_end_time: 13 }]);

    const response = await fixTiming({ currentText: 'ENTER CODE BEAST FORTY NOW TODAY PLEASE NOW' });

    expect(mockedCallLlmChat).not.toHaveBeenCalled();
    expect(response.suggestions[0].unchanged).toBe(true);
    expect(response.suggestions[0].reason).toMatch(/on-screen text is kept word for word/);
  });

  it('turns a reply over the word budget into a 502', async () => {
    stubHappyWorld();
    stubDialogs([{ dialog_start_time: 12, dialog_end_time: 13 }]);
    mockedCallLlmChat.mockResolvedValue({ text: 'She still very carefully tips the plant out of it.', model: 'gpt-4o-mini', responseId: 'r' });

    await expect(fixTiming({ currentText: 'She carefully tips the plant out of it.' })).rejects.toMatchObject({ status: 502 });
  });

  it('suggests a new start time when shortening would drop too much', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([makeClip(PREV_CLIP_ID, 2, 'Earlier.'), makeClip(CLIP_ID, 10, baseInput.currentText, 4), makeClip(NEXT_CLIP_ID, 20, 'Later.', 4)]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);
    stubDialogs([{ dialog_start_time: 11, dialog_end_time: 12.5 }]);

    const response = await fixTiming();

    expect(mockedCallLlmChat).not.toHaveBeenCalled();
    expect(response.suggestions[0].timingChange).toEqual({ startTime: 12.5 });
    expect(response.suggestions[0].unchanged).toBe(true);
  });

  it('suggests extended playback when there is no gap nearby', async () => {
    stubAudioDescription(ownedAudioDescription);
    stubClips([makeClip(CLIP_ID, 10, baseInput.currentText, 4)]);
    stubVideo({ title: 'A video', duration: 60 });
    stubNextDialog(null);
    stubDialogs([{ dialog_start_time: 6, dialog_end_time: 20 }]);

    const response = await fixTiming();

    expect(response.suggestions[0].timingChange).toEqual({ track: 'extended' });
    expect(response.suggestions[0].reason).toMatch(/extended playback/);
  });

  it('writes nothing to the database', async () => {
    stubHappyWorld();
    stubDialogs([]);
    const writeSpies = [
      jest.spyOn(MongoAudioClipsModel as any, 'updateOne'),
      jest.spyOn(MongoAudioClipsModel as any, 'updateMany'),
      jest.spyOn(MongoAudioClipsModel as any, 'findByIdAndUpdate'),
    ];

    await fixTiming();

    writeSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
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

    await new RefineService().getSuggestion({ ...baseInput, presetId: 'make-concise' });

    writeSpies.forEach(spy => expect(spy).not.toHaveBeenCalled());
  });
});
